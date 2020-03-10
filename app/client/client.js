const APP = {
	sort: 0,
	favicon: "&#9733;",
	nav: getCookie("nav") || "BTC",
	market: getCookie("market") || "Gemini:BTC/USD",
	favorites: getCookie("favorites") || "{}",
	assets: {},
	cacheArr: [],
	datafeed: {}
};

const socket = io();

function connectRoom (room) {
	socket.emit("leaveAll");
	APP.nav = room;
	setCookie("nav", room, 30);
	if(room === "favorites") {
		let favs = Object.keys(APP.favorites);
		if(favs.length) {
			favs.forEach(function (market) {
				socket.emit("join", market);
			});
		}
		else {
			//display empty list
			buildCacheArr();
			renderList();
		}
	}
	else socket.emit("join", room);
}

function subAsset (asset, next) {
	socket.emit("subAsset", asset, function (result) {
		if(result) {
			APP.assets[asset] = result;
			setCookie("assets", JSON.stringify(Object.keys(APP.assets)), 30);
			next();
		}
	});
}

function updateCache (update) {
	Object.entries(update).forEach(function (row) {
		let asset = getAssetFromMarket(row[0]);
		APP.assets[asset].markets[row[0]] = row[1];
	});
	buildCacheArr();
}

function buildCacheArr () {
	let markets = APP.nav === "favorites" ? APP.favorites : APP.assets[APP.nav].markets;
	APP.cacheArr = Object.keys(markets).map(function (market) {
		let arr = [],
			exchange = market.split(":")[0],
			pair = market.split(":")[1],
			asset = pair.split("/")[0];
		arr.push(market);
		arr.push(APP.favorites[market] ? 1 : 0);
		arr.push(exchange);
		arr.push(pair);
		arr.push(Math.abs(parseFloat(APP.assets[asset].markets[market][0])));
		arr.push(parseFloat(APP.assets[asset].markets[market][1]));
		arr.push(parseFloat(APP.assets[asset].markets[market][2]));
		return arr;
	});
	sortCacheArr();
}

function sortCacheArr () {
	APP.cacheArr.sort(function (a, b) {
		let col = Math.abs(APP.sort);
		if (a[col] === b[col]) return 0;
		if(APP.sort < 0) return a[col] > b[col] ? -1 : 1;
		return a[col] < b[col] ? -1 : 1;
	});
}

function toggleSort (col) {
	APP.sort = APP.sort < 0 ? col : -col;
}

socket.on("init", function (instance) {
	if(APP.instance && APP.instance !== instance) {
		socket.disconnect();
		location.reload();
		return;
	}
	APP.instance = instance;	
	APP.favorites = JSON.parse(APP.favorites);
	
	let assets;

	if(location.hostname.includes("cryptolist.com")) {
		document.getElementById("clc").hidden = false;
		assets = getCookie("assets") || "[]";
		assets = JSON.parse(assets);
		if(assets.length === 0) {
			assets = ["BTC","ETH","XRP","BCHABC","USDT","BSV","LTC","EOS","BNB","XTZ","LINK","ADA","XLM","TRX","XMR","ETC"];
		}
	}
	else {
		document.getElementById("blb").hidden = false;
		assets = ["BTC"];
	}
	
	assets.forEach(nav => { 
		subAsset(nav, renderNavs); 
	});
	
	connectRoom(APP.nav);
});

socket.on("joinedroom", function (snapshot) {
	updateCache(snapshot);
	renderList();
});

socket.on("update", function (update) {
	updateCache(update);
	updateList(update);
});

socket.on("candle", function (candle) {
	let update = {
		time: parseInt(candle[0]) * 1000,
		open: parseFloat(candle[1]),
		high: parseFloat(candle[2]),
		low: parseFloat(candle[3]),
		close: parseFloat(candle[4]),
		volume: parseFloat(candle[5])
	}
	APP.onRealtimeCallback(update);
});