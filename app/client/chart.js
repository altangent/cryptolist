//APP.datafeed
(function () {
  let symbolInfoBase = {
    name: "",
    ticker: "",
    description: "",
    type: "bitcoin",
    session: "24x7",
    exchange: "",
    timezone: "Etc/UTC",
    pricescale: 10000,
    minmov: 1,
    has_intraday: true,
    supported_resolutions: ["1", "5", "15", "30", "60", "120", "240", "D"],
    intraday_multipliers: ["1", "5", "15", "30", "60", "120", "240"],
    has_seconds: false,
    has_daily: true,
    has_weekly_and_monthly: false,
    has_empty_bars: true,
    force_session_rebuild: true,
    has_no_volume: false,
    volume_precision: 4,
    data_status: "streaming",
    expired: false,
    sector: "cryptocurrency",
    industry: "Crypto Asset",
    currency_code: "$",
  };

  function onReady(callback) {
    //console.log("onReady");
    setTimeout(() =>
      callback({
        exchanges: [],
        symbolsTypes: [],
        supported_resolutions: ["1", "5", "15", "30", "60", "120", "240", "D"],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        futures_regex: null,
      })
    );
  }

  function searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
    // no need to implement
    //console.log("search symbols", userInput, exchange, symbolType, onResultReadyCallback);
  }

  function resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
    let quote = symbolName.split("/")[1];
    let priceScale = quote.match(/USD|EUR|JPY|AUD|GBP|KRW|CNY/) ? 100 : quote === "BTC" ? 100000000 : 10000;
    let symbol = Object.assign({}, symbolInfoBase, {
      name: symbolName,
      ticker: symbolName,
      description: symbolName,
      pricescale: priceScale
    });
    setTimeout(() => onSymbolResolvedCallback(symbol));
  }

  function getBars(
    symbolInfo,
    resolution,
    from,
    to,
    onHistoryCallback,
    onErrorCallback,
    firstDataRequest
  ) {

    switch (resolution) {
      case "D":
        resolution = "_1d";
        break;
      case "1":
        resolution = "_1m";
        break;
      case "5":
        resolution = "_5m";
        break;
      case "15":
        resolution = "_15m";
        break;
      case "30":
        resolution = "_30m";
        break;
      case "60":
        resolution = "_1h";
        break;
      case "120":
        resolution = "_2h";
        break;
      case "240":
        resolution = "_4h";
        break;
    }

    let [exchange, pair] = symbolInfo.name.split(":");
    let [base, quote] = pair.split("/");

    let query = `
    query ohlc (
      $baseSymbol: String!
      $quoteSymbol: String!
      $exchangeSymbol: String!
      $resolution: TimeResolution!
      $start: Int!
      $end: Int!
    ) {
      markets(filter:{
          exchangeSymbol:{ _eq:$exchangeSymbol }
          baseSymbol:{ _eq:$baseSymbol }
          quoteSymbol:{ _eq:$quoteSymbol }
      }) {
        ohlcv(resolution:$resolution start:$start end:$end sort:OLD_FIRST)
      }
    }`;
    let variables = {
      exchangeSymbol: exchange,
      baseSymbol: base,
      quoteSymbol: quote,
      resolution,
      start: from,
      end: to,
    };

    let body = JSON.stringify({ query: query, variables: variables });
    
    socket.emit("proxy", body, function (res) {
      Promise.resolve(res)
      .then(json => {
        if(json.errors) {
          throw new Error(json.errors[0].message);
        }
        return json.data.markets[0].ohlcv.map(p => {
            return {
              time: parseInt(p[0]) * 1000,
              open: parseFloat(p[1]),
              high: parseFloat(p[2]),
              low: parseFloat(p[3]),
              close: parseFloat(p[4]),
              volume: parseFloat(p[5])
            }
          });
      })
      .then(bars => {
        if(bars.length) onHistoryCallback(bars, {noData: false});
        else onHistoryCallback(bars, {noData: true});
      })
      .catch(err => {
        console.error(err);
        onErrorCallback(err);
      });
    });
  }

  function subscribeBars(
    symbolInfo,
    resolution,
    onRealtimeCallback,
    subscriberUID,
    onResetCacheNeededCallback
  ) {
    //console.log("subscribeBars", symbolInfo.name + "_" + resolution);
    APP.onRealtimeCallback = onRealtimeCallback;
    socket.emit("subCandle", symbolInfo.name + "_" + resolution);
  }

  function unsubscribeBars(subscriberUID) {
    //console.log("unsubscribeBars", subscriberUID);
    socket.emit("unsubCandle", subscriberUID);
  }

  function calculateHistoryDepth(resolution, resolutionBack, intervalBack) {
    //console.log("calculateHistoryDepth", resolution, resolutionBack, intervalBack);
    if (intervalBack > 2000) return { resolution, resolutionBack, intervalBack: 2000 };
    return undefined;
  }

  function getMarks(symbolInfo, startDate, endDate, onDataCallback, resolution) {
    // no need to implement
    //console.log("getMarks");
  }

  function getTimescaleMarks(symbolInfo, startDate, endDate, onDataCallback, resolution) {
    // no need to implement
    //console.log("getTimescaleMarks");
  }

  function getServerTime(callback) {
    callback(Math.floor(Date.now() / 1000));
  }

  APP.datafeed = {
    onReady,
    searchSymbols,
    resolveSymbol,
    getBars,
    subscribeBars,
    unsubscribeBars,
    calculateHistoryDepth,
    getMarks,
    getTimescaleMarks,
    getServerTime,
  };
})();

//TradingView 
APP.tvWidget = new window.TradingView.widget({
  autosize: true,
  symbol: APP.market,
  interval: "240",
  timezone: "Etc/UTC",
  container_id: "chart",
  datafeed: APP.datafeed,
  library_path: "/trading-view/charting_library/",
  custom_css_url: "/css/tradingview.css",
  locale: "en",
  enabled_features: [],
  disabled_features: [
    "header_symbol_search",
    "symbol_search_hot_key"
  ],
  time_frames: [
    { text: "1y", resolution: "D", description: "1 Year", title: "1y" },
    { text: "3m", resolution: "D", description: "3 Months", title: "3m" },
    { text: "1m", resolution: "240", description: "1 Month", title: "1m" },
    { text: "14d", resolution: "60", description: "2 Weeks", title: "14d" },
    { text: "7d", resolution: "30", description: "1 Week", title: "7d" },
    { text: "3d", resolution: "15", description: "3 Days", title: "3d" },
    { text: "1d", resolution: "5", description: "1 Day", title: "1d" },
    { text: "6h", resolution: "1", description: "6 hours", title: "6h" },
  ],
  toolbar_bg: "#000000",
  toolbar: "#000000",
  overrides: {
    "symbolWatermarkProperties.color": "rgba(0,0,0,0)",
    "mainSeriesProperties.style": 1,
    "mainSeriesProperties.barStyle.upColor": "limegreen",
    "mainSeriesProperties.barStyle.downColor": "red",
    "mainSeriesProperties.candleStyle.drawWick": true,
    "mainSeriesProperties.candleStyle.drawBorder": true,
    "mainSeriesProperties.candleStyle.wickUpColor": "limegreen",
    "mainSeriesProperties.candleStyle.wickDownColor": "red",
    "mainSeriesProperties.candleStyle.upColor": "darkgreen",
    "mainSeriesProperties.candleStyle.downColor": "darkred",
    "mainSeriesProperties.candleStyle.borderUpColor": "limegreen",
    "mainSeriesProperties.candleStyle.borderDownColor": "red",
    "mainSeriesProperties.hollowCandleStyle.drawWick": true,
    "mainSeriesProperties.hollowCandleStyle.drawBorder": true,
    "mainSeriesProperties.hollowCandleStyle.upColor": "green",
    "mainSeriesProperties.hollowCandleStyle.downColor": "darkred",
    "mainSeriesProperties.hollowCandleStyle.borderUpColor": "green",
    "mainSeriesProperties.hollowCandleStyle.borderDownColor": "red",    
    "mainSeriesProperties.hollowCandleStyle.wickUpColor": "green",
    "mainSeriesProperties.hollowCandleStyle.wickDownColor": "red",
    "mainSeriesProperties.lineStyle.color": "lightsteelblue",
    "mainSeriesProperties.areaStyle.color1": "steelblue",
    "mainSeriesProperties.areaStyle.color2": "rgba(0,0,0,0)",
    "mainSeriesProperties.areaStyle.linecolor": "lightsteelblue",
    "paneProperties.background": "#000000",
    "paneProperties.vertGridProperties.color": "#222222",
    "paneProperties.horzGridProperties.color": "#222222",
    "scalesProperties.textColor": "#888888",
    "scalesProperties.backgroundColor": "#222222",
    "scalesProperties.lineColor": "#222222"
  },
  saved_data: getChartState(),
});



// TradingView State
APP.tvWidget.onChartReady(() => {
  APP.tvWidget.subscribe('onAutoSaveNeeded', () => {
    APP.tvWidget.save(saveChartState);
  });
});

function getChartState() {
  let state = localStorage.getItem('tvWidget');
  if (state) {
    try {
      return JSON.parse(state);
    }
    catch (ex) {
      console.warn('failed to deserialize chart state');
    }
  }
}

function saveChartState(state) {
  localStorage.setItem('tvWidget', JSON.stringify(state));
  //console.log('chart saved');
}