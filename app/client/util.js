function setCookie (cname, cvalue, exdays) {
	let d = new Date();
	d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
	let expires = "expires=" + d.toUTCString();
	document.cookie = cname + "=" + cvalue + "; " + expires + "; path=/;";
}

function getCookie (cname) {
	let name = cname + "=";
	let ca = document.cookie.split(";");
	for(let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while(c.charAt(0) === " ") c = c.substring(1);
		if(c.indexOf(name) === 0) return c.substring(name.length, c.length);
	}
	return "";
}

function curDec (quote) {
	return quote.match(/USD|EUR|JPY|AUD|GBP|KRW|CNY|DAI|PAX|CAD|TUSD|USDC|USDT|GUSD/) ? 2 : "auto";
}

function getAssetFromMarket (market) {
	return market.split(":")[1].split("/")[0];
}

function numFmt (num = 0, sep = ",", dec = "auto") {
	let parts = parseFloat(num);
	if(dec !== "auto") {
		parts = parts.toFixed(dec);
	}
	parts = parts.toString().split(".");
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);	
	if(parts[1]) {	
		for(let x = 0, l = parts[1].length; x < l; x++) {
			if(parts[1][x] !== "0") {
				dec = x + 4; //auto == 4 sig figs
				break;
			}
		}
		parts[1] = parts[1].substring(0, dec);
	}
	return parts.join(".");
}
