const 	request = require("request"),
		config = require("config");

const topRankedQuery = `
query topRanked ($limit: Int!) {
	assets(sort:{ marketCapRank: ASC } page: { limit: $limit }) {
		assetName
		assetSymbol
		marketCapRank
		markets {
			marketSymbol
			ticker {
				lastPrice
				baseVolume
				percentChange
			}
		}
	}
}
`;

const filteredQuery = `
query filtered ($symbols: [String]!) {
	assets(filter:{ assetSymbol: {_in: $symbols}}) {
		assetName
		assetSymbol
		marketCapRank
		markets(filter:{ marketType: { _eq: Spot }}) {
			marketSymbol
			ticker {
				lastPrice
				baseVolume
				percentChange
			}
		}
	}
}
`;

const candleQuery = `
query ohlc ($marketSymbol: String!, $resolution: TimeResolution!) {
	markets(filter:{ marketSymbol: {_eq: $marketSymbol }}) {
		ohlcv(resolution: $resolution, limit: 1)
	}
}
`;

function convertResolution (resolution) {
	switch (resolution) {
		case "D": return "_1d";
		case "1": return "_1m";
		case "5": return "_5m";
		case "15": return "_15m";
		case "30": return "_30m";
		case "60": return "_1h";
		case "120": return "_2h";
		case "240": return "_4h";
	}
}

function callApi (content) {
	let options = {
		uri: "https://api.blocktap.io/graphql",
		method: "POST",
		body: content,
		headers: {
			"Content-Type": "application/json",
			"Content-Length": content.length,
			"Authorization": "Bearer " + config.get("apiKey")
		}
	};

	return new Promise ((resolve, reject) => {
		request(options, (err, res, body) => {
			if(err) reject(err);
			else {
				try {
					body = JSON.parse(body);
					resolve(body);
				}
				catch(ex) {
					console.log(ex);
					reject(ex);
				}
			}
		});
	});
}

module.exports = {
	getTopRanked: function (assetCount) {
		let variables = { "limit": assetCount };
		let content = JSON.stringify({ query: topRankedQuery, variables: variables });
		return callApi(content);
	},
	getFiltered: function (assetArr) {
		let variables = { "symbols": assetArr };
		let content = JSON.stringify({ query: filteredQuery, variables: variables });
		return callApi(content);
	},
	getCandle: function (marketSymbol, resolution) {
		let variables = { "marketSymbol": marketSymbol, "resolution": convertResolution(resolution) };
		let content = JSON.stringify({ query: candleQuery, variables: variables });
		return callApi(content);
	},
	callApi: function (body) {
		return callApi(body);
	}
}
