"use strict"

const 	compress = require("compression"),
		socketio = require("socket.io"),
		blocktap = require("./blocktap"),
		uglifyES = require("uglify-es"),
		express = require("express"),
		favicon = require("serve-favicon"),
		http = require("http"),
		fs = require("fs"),
		app = express();

const   VERSION = JSON.parse(fs.readFileSync("package.json")).version,
		INSTANCE = VERSION + "_" + Date.now(),
		CACHE = {
			candle: {},
			assets: {}
		},
		ASSETS = {},
		CANDLES = {};

const 	server = http.createServer(app);
const 	io = socketio(server);

app.set("json spaces", 2);
app.use(favicon(__dirname + "/images/favicon.ico"));
app.use("/css", express.static(__dirname + "/css"));
app.use("/images", express.static(__dirname + "/images"));
app.use("/trading-view", express.static(__dirname + "/trading-view"));
app.use(compress());

app.locals.clientcss = fs.readFileSync(__dirname + "/css/client.css", "utf8");

app.locals.clientjs = 	fs.readFileSync(__dirname + "/client/client.js", "utf8") +
						fs.readFileSync(__dirname + "/client/chart.js", "utf8") +
						fs.readFileSync(__dirname + "/client/util.js", "utf8") +
						fs.readFileSync(__dirname + "/client/ui.js", "utf8");

app.locals.clientjs = process.env.NODE_ENV !== "DEV" ? uglifyES.minify(app.locals.clientjs).code : app.locals.clientjs;

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/html/index.html");
});

app.get("/client.css", (req, res, next) => {
	res.type("text/css");
	res.send(app.locals.clientcss);
	next();
});

app.get("/client.js", (req, res, next) => {
	res.type("application/javascript");
	res.send(app.locals.clientjs);
	next();
});

io.on("connection", socket => {
	console.log("new socket connection: " + socket.id);
	console.log(Object.keys(io.sockets.sockets).length + " socket(s) connected");

	socket.emit("init", INSTANCE);

	socket.on("proxy", (body, next) => {
		blocktap.callApi(body)
		.then(next);
	});

	socket.on("join", room => {
		if(CACHE.assets[room]) {
			socket.emit("joinedroom", CACHE.assets[room].markets);
		}
		else {
			let asset = getAssetFromMarket(room);
			if(CACHE.assets[asset].markets[room]) {
				let markets = {};
				markets[room] = CACHE.assets[asset].markets[room];
				socket.emit("joinedroom", markets);
			}
		}
		socket.join(room);
	});

	socket.on("leave", room => {
		socket.leave(room);
	});

	socket.on("leaveAll", function () {
		Object.keys(socket.rooms).forEach(room => {
			if(room === socket.id) return;
			socket.leave(room);
		});
	});

	socket.on("subCandle", marketSymbol => {
		subCandle(marketSymbol, socket.id);
	});

	socket.on("unsubCandle", marketSymbol => {
		unsubCandle(marketSymbol, socket.id);
	});

	socket.on("subAsset", (asset, next) => {
		let res = subAsset(asset, socket.id);
		next(res);
	});

	socket.on("unsubAsset", asset => {
		unsubAsset(asset, socket.id);
	});

	socket.on("disconnect", () => {
		Object.keys(ASSETS).forEach(asset => {
			unsubAsset(asset, socket.id);
		});

		Object.keys(CANDLES).forEach(marketSymbol => {
			unsubCandle(marketSymbol, socket.id);
		});
		console.log("socket disconnected: " + socket.id);
	});
	socket.on("error", error => {
		console.log("socket error: " + socket.id + ": " + error);
	});
});

function getAssetFromMarket (market) {
	return market.split(":")[1].split("/")[0];
}

function subAsset (asset, socketid) {
	if(CACHE.assets[asset]) {
		if(ASSETS[asset]) {
			if(ASSETS[asset].includes(socketid)) return false;
			ASSETS[asset].push(socketid);
		}
		else ASSETS[asset] = [socketid];
		return CACHE.assets[asset];
	}
	return false;
}

function unsubAsset (asset, socketid) {
	if(ASSETS[asset]) {
		let index = ASSETS[asset].indexOf(socketid);
		if(index !== -1) ASSETS[asset].splice(index, 1);
		if(ASSETS[asset].length === 0) {
			delete ASSETS[asset];
		}
	}
}

function subCandle (marketSymbol, socketid) {
	if(CANDLES[marketSymbol]) CANDLES[marketSymbol].push(socketid);
	else CANDLES[marketSymbol] = [socketid];
	CACHE.candle[marketSymbol] = CACHE.candle[marketSymbol] || [];
}

function unsubCandle (marketSymbol, socketid) {
	if(CANDLES[marketSymbol]) {
		let index = CANDLES[marketSymbol].indexOf(socketid);
		if(index !== -1) CANDLES[marketSymbol].splice(index, 1);
		if(CANDLES[marketSymbol].length === 0) {
			delete CANDLES[marketSymbol];
			delete CACHE.candle[marketSymbol];
		}
	}
}

function pollCandleSubs () {
	Object.keys(CANDLES).forEach(marketSymbol => {
		let [sym, res] = marketSymbol.split("_");
		blocktap.getCandle(sym, res).then(candle => {
			let latest = candle.data.markets[0].ohlcv[0],
				cached = CACHE.candle[marketSymbol];
			if(cached && latest) {
				if(cached.toString() !== latest.toString()) {
					cached[0] = parseInt(latest[0]);
					cached[1] = parseFloat(latest[1]) > 0 ? latest[1] : cached[4];
					cached[2] = parseFloat(latest[2]) > 0 ? latest[2] : cached[4];
					cached[3] = parseFloat(latest[3]) > 0 ? latest[3] : cached[4];
					cached[4] = parseFloat(latest[4]) > 0 ? latest[4] : cached[4];
					cached[5] = latest[5];
					CANDLES[marketSymbol].forEach(socketid => {
						io.to(socketid).emit("candle", cached);
					});
				}
			}			
		})
		.catch(console.log);
	});
}

function initCache (next) {
	blocktap.getFiltered([]).then(snapshot => {
		CACHE.assets = {};
		snapshot.data.assets.forEach(asset => {
			let markets = {};
			asset.markets.forEach(market => {
				if(market.ticker) {
					let ma = [];
					ma.push(market.ticker.lastPrice);
					ma.push(market.ticker.baseVolume);
					ma.push(market.ticker.percentChange);
					markets[market.marketSymbol] = ma;
				}
			});
			CACHE.assets[asset.assetSymbol] = { 
				name: asset.assetName, 
				rank: asset.marketCapRank,
				markets: markets
			};
		});
	})
	.then(next)
	.catch(console.log);
}

function updateCache () {
	let assetList = Object.keys(ASSETS);
	Object.keys(io.sockets.adapter.rooms).forEach(room => {
		if(/^[A-Z0-9]+:[A-Z]+\/[A-Z]+$/i.test(room)) {
			let asset = getAssetFromMarket(room);
			if(assetList.includes(asset) === false) assetList.push(asset);
		}
	});
	
	if(assetList.length) {
		blocktap.getFiltered(assetList).then(snapshot => {
			snapshot.data.assets.forEach(asset => {
				let update = {};
				asset.markets.forEach(market => {
					if(market.ticker) {
						let cached = CACHE.assets[asset.assetSymbol];
						if(cached && cached.markets && cached.markets[market.marketSymbol] && 
						Math.abs(cached.markets[market.marketSymbol][0]) !== Math.abs(market.ticker.lastPrice)) {						
							if(Math.abs(market.ticker.lastPrice) < Math.abs(cached.markets[market.marketSymbol][0])) {
								market.ticker.lastPrice = "-" + market.ticker.lastPrice;
							}
							else market.ticker.lastPrice = "+" + market.ticker.lastPrice;
							let upd = {},
								ma = [];
							
							ma.push(market.ticker.lastPrice);
							ma.push(market.ticker.baseVolume);
							ma.push(market.ticker.percentChange);
							cached.markets[market.marketSymbol] = ma;
							update[market.marketSymbol] = ma;
							upd[market.marketSymbol] = ma;
							io.to(market.marketSymbol).emit("update", upd);
						}
					}
				});
				if(Object.keys(update).length) {
					io.to(asset.assetSymbol).emit("update", update);			
				}
			});
		})
		.catch(console.log);
	}
}

function repeatTask (task, seconds, init) {
	if(init) task();
	(function runTask () {
		setTimeout(function () {
			task();
			runTask();
		}, seconds * 1000);
	})();
}

initCache(() => {
	server.listen(8123, () => {
		console.log("Express server started on port " + server.address().port);
	});
	repeatTask(updateCache, 3, true);
	repeatTask(pollCandleSubs, 2);
});

process.once("SIGUSR2", function () {
	server.close(function () {
		process.kill(process.pid, "SIGUSR2");
	});
});
