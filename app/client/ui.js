const DOM = {
	name: document.getElementById("name"),
	main: document.getElementById("main"),
	header: document.getElementById("header"),
	navs: document.getElementById("navs"),
	list: document.getElementById("list"),
	chart: document.getElementById("chart")
};

DOM.name.onclick = swapLayout;
addHover(DOM.name);

function toggleFavorite () {
	let market = this.parentNode.id;

	if(APP.favorites[market]) {
		this.classList.remove("favorited");
		delete APP.favorites[market];
		
		if(APP.nav === "favorites") {
			this.parentNode.parentNode.removeChild(this.parentNode);
			socket.emit("leave", market);
		}
		
		buildCacheArr();
	}
	else {
		this.classList.add("favorited");
		APP.favorites[market] = getAssetFromMarket(market);		
	}
	setCookie("favorites", JSON.stringify(APP.favorites), 30);
	toggleSearch();
}

function toggleSearch (mode) {
	DOM.searchInput.value = "";
	let navs = DOM.navs.getElementsByClassName("asset");
	
	if(mode === "searchEdit") {
		for(let i = 0, l = navs.length; i < l; i++) {
			let nav = navs[i];
			if(Object.values(APP.favorites).includes(nav.id)) nav.classList.add("active");
			else nav.classList.add("edit");
		};
		DOM.searchEdit.hidden = true;
		DOM.searchInput.hidden = false;
		DOM.searchInput.focus();
		return;
	}
	
	for(let i = 0, l = navs.length; i < l; i++) {
		let nav = navs[i];
		nav.classList.remove("edit");
		nav.classList.remove("active");
	};
	DOM.searchEdit.hidden = false;
	DOM.searchInput.hidden = true;
}

function addHover (element) {
	element.onmouseover = function () { this.classList.add("hover"); }
	element.onmouseout = function () { this.classList.remove("hover"); }
}

function addSortEvents (th, col) {
	th.onclick = function () { 
		toggleSort(col);
		sortCacheArr();
		renderList();
	};
}

function addRowEvents (tr) {
	addHover(tr);
	tr.onclick = function () {
		APP.market = this.id;
		deselectChildren(DOM.list);
		this.classList.add("selected");
		setCookie("market", APP.market, 30);
		APP.tvWidget.setSymbol(APP.market, APP.tvWidget.chart().resolution()); 
		document.title = this.firstChild.nextSibling.nextSibling.nextSibling.innerHTML + " " + APP.market.split(":")[1] + " " + APP.market.split(":")[0];
	};
}

function addNavEvents (nav) {
	addHover(nav);
	nav.onclick = function () {
		if(this.classList.contains("edit")) {
			socket.emit("unsubAsset", this.id);
			if(APP.nav === this.id) DOM.favorites.click();
			this.remove();
			delete APP.assets[this.id];
			setCookie("assets", JSON.stringify(Object.keys(APP.assets)), 30);
		}
		else if(!this.classList.contains("active")) {
			deselectChildren(this.parentNode);
			this.classList.add("selected");
			connectRoom(this.id);
		}
		toggleSearch();
	};
}

function deselectChildren (parent) {
	let elements = parent.getElementsByClassName("selected");
	for(let x = 0, l = elements.length; x < l; x++) {
		elements[x].classList.remove("selected");
	}
}

function swapLayout () {	
	if(DOM.main.getElementsByTagName("div")[0].id === "list") {
		DOM.main.appendChild(DOM.list);
		return;
	}
	DOM.main.insertBefore(DOM.list, DOM.chart);
}

function createList () {
	let d = document.createElement("div"),
		t = document.createElement("table"),
		tb = document.createElement("tbody"),
		tr = document.createElement("tr"),
		th = document.createElement("th");

	d.id = "list";
	th.innerHTML = APP.favicon;
	th.classList.add("favicon");
	addSortEvents(th, 1);
	tr.appendChild(th);

	th = document.createElement("th");
	th.appendChild(document.createTextNode("Exchange"));
	addSortEvents(th, 2);
	tr.appendChild(th);

	th = document.createElement("th");
	th.appendChild(document.createTextNode("Pair"));
	addSortEvents(th, 3);
	tr.appendChild(th);

	th = document.createElement("th");
	th.appendChild(document.createTextNode("Price"));
	th.classList.add("right");
	addSortEvents(th, 4);
	tr.appendChild(th);

	th = document.createElement("th");
	th.appendChild(document.createTextNode("Volume"));
	th.classList.add("right");
	addSortEvents(th, 5);
	tr.appendChild(th);

	th = document.createElement("th");
	th.appendChild(document.createTextNode("24h %"));
	th.classList.add("right");
	addSortEvents(th, 6);
	tr.appendChild(th);

	tb.appendChild(tr);

	APP.cacheArr.forEach(function (row) {
		let market = row[0],
			favorite = row[1],
			asset = row[3].split("/")[0],
			quote = row[3].split("/")[1],
			exchange = row[2],
			pair = row[3],
			price = numFmt(row[4],",",curDec(quote)),
			volume = numFmt(row[5],",",0),
			change = numFmt(row[6],",",2),
			pcolor = APP.assets[asset].markets[market][0][0] === "-" ? "red" : APP.assets[asset].markets[market][0][0] === "+" ? "green" : "",
			ccolor = row[6] < 0 ? "red" : "green",
			tr = document.createElement("tr"),
			td = document.createElement("td");
		
		tr.id = market;
		addRowEvents(tr);
		if(APP.market === market) {
			tr.classList.add("selected");
			document.title = price + " " + pair + " " + exchange;
		}
		
		td.innerHTML = APP.favicon;
		td.classList.add("favicon");
		td.classList.add("dark");
		if(favorite) td.classList.add("favorited");
		td.onclick = toggleFavorite;

		tr.appendChild(td);
		
		td = document.createElement("td");
		td.appendChild(document.createTextNode(exchange));
		tr.appendChild(td);

		td = document.createElement("td");
		td.appendChild(document.createTextNode(pair));
		tr.appendChild(td);

		td = document.createElement("td");
		td.appendChild(document.createTextNode(price));
		td.classList.add("right");
		if(pcolor) td.classList.add(pcolor);
		tr.appendChild(td);

		td = document.createElement("td");
		td.appendChild(document.createTextNode(volume));
		td.classList.add("right");
		tr.appendChild(td);

		td = document.createElement("td");
		td.appendChild(document.createTextNode(change));
		td.classList.add("right");
		td.classList.add(ccolor);
		tr.appendChild(td);
		
		tb.appendChild(tr);
	});

	t.appendChild(tb);
	d.appendChild(t);
	return d;
}

function createNav (asset) {
	let span = document.createElement("span");		
	span.id = asset;
	span.classList.add("asset");
	if(APP.nav === asset) span.classList.add("selected");
	span.appendChild(document.createTextNode(asset));

	addNavEvents(span);		
	return span;
}

function createNavs () {
	let navs = document.createElement("div"),
		span = document.createElement("span"),
		input = document.createElement("input");
	
	navs.id = "navs";
	span.id = "favorites";
	span.innerHTML = APP.favicon;
	if(APP.nav === "favorites") span.classList.add("selected");
	addNavEvents(span);
	DOM.favorites = span;
	navs.appendChild(span);
	
	Object.keys(APP.assets).forEach(asset => {	
		navs.appendChild(createNav(asset));
	});
	
	if(location.hostname.includes("cryptolist.com")) {
		span = document.createElement("span");
		span.id = "searchEdit";
		span.appendChild(document.createTextNode("[+/-]"));
		addHover(span);
		span.onclick = function () { toggleSearch(this.id); };
		navs.appendChild(span);
	
		input.id = "searchInput";
		input.type = "text";
		input.hidden = true;
		input.size = 3;
		input.onkeydown = function (e) {
			if(e.keyCode === 27) {
				toggleSearch();
				return;
			}
			if(e.keyCode !== 13) return;
			e.preventDefault();

			let asset = DOM.searchInput.value.toUpperCase();
			subAsset(asset, function () {
				renderNavs();
				setCookie("assets", JSON.stringify(Object.keys(APP.assets)), 30);
			});
			toggleSearch();
		};
		navs.appendChild(input);
	}

	return navs;
}

function updateList (update) {
	Object.entries(update).forEach(function (row) {
		let market = row[0],
			exchange = market.split(":")[0],
			pair = market.split(":")[1],
			asset = pair.split("/")[0],
			pcolor = APP.assets[asset].markets[market][0][0] === "-" ? "red" : APP.assets[asset].markets[market][0][0] === "+" ? "green" : "",
			ccolor = row[5] < 0 ? "red" : "green",
			price = numFmt(Math.abs(parseFloat(row[1][0])),",",curDec(row[0].split("/")[1])),
			element = document.getElementById(market).firstChild.nextSibling.nextSibling.nextSibling;

		if(APP.market === market) document.title = price + " " + pair + " " + exchange;
		element.innerHTML = price;
		if(pcolor) {
			element.classList.remove("red", "green");
			element.classList.add(pcolor);
		}
		element = element.nextSibling;
		element.innerHTML = numFmt(parseFloat(row[1][1]),",",0);
		element = element.nextSibling;
		element.innerHTML = numFmt(parseFloat(row[1][2]),",",2);
		element.classList.add(ccolor);
	});
}

function renderNavs () {
	DOM.header.replaceChild(createNavs(), DOM.navs);
	DOM.navs = document.getElementById("navs");
	DOM.searchEdit = document.getElementById("searchEdit");
	DOM.searchInput = document.getElementById("searchInput");
}

function renderList () {
	DOM.main.replaceChild(createList(), DOM.list);
	DOM.list = document.getElementById("list");
}