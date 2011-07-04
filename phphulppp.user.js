// ==UserScript==
// @name			PHPHulp++
// @namespace		http://phphulp.ikhoefgeen.nl/ubb
// @description		Markeert per topic welke posts nieuw zijn, geeft je de mogelijkheid dingen als favoriet te markeren, en 
// @include			http://*.phphulp.nl/*
// @include			http://phphulp.nl/*
// @exclude			http://*.phphulp.nl/includes/ads/*
// @version			0.12.5
// ==/UserScript==

// lounge_topics_in_recent_menu (default=true)
//	Toon koffiehoek-topics in recente items menu
//
// enable_recent_menu (default=true)
//	Overschrijf recente items menu met variant die de RSS feed als bron gebruikt
//	en automatisch updatet.
//
// Gebruik: localStorage['preferences.%naam%'] = JSON.stringify(true|false)

(function() {
	
	if (document.body && document.body.classList.contains('phphulppp'))
		return;
	
	document.body.classList.add('phphulppp');
	
	var version = '0.12.5';
	
	var Colors = {
		Blue: '#465CB1',
		LightBlue: '#A0ABC8',
		Grey: 'silver'
	}
	
	var Icons = {
		Bullet: '•',
		BlackStar: '★',
		WhiteStar: '☆'
	}
	
	var Types = {
		Forum: {
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/forum\/$/
		},
		ForumTopic: {
			namespace: 'forum.topic',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/forum\/topic\/(?:[a-z0-9\-]+)\/(\d+)\//,
			link: 'http://www.phphulp.nl/forum/topic/-/{$id}/last/'
		},
		ForumCategory: {
			namespace: 'forum.category',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/forum\/(?:[a-z0-9\-]+)\/(\d+)\//,
			link: 'http://www.phphulp.nl/forum/-/{$id}/'
		},
		User: {
			namespace: 'user',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?\/profiel\/(?:[a-z0-9\-]+)\/(\d+)\/$/,
			link: 'http://www.phphulp.nl/profiel/-/{$id}/'
		},
		Tutorial: {
			namespace: 'tutorials.tutorial',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/tutorial\/(?:[a-z0-9\-]+)\/(?:[a-z0-9\-]+)\/(\d+)\/$/,
			link: 'http://www.phphulp.nl/php/tutorial/-/-/{$id}/'
		},
		TutorialCategory: {
			namespace: 'tutorials.category',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/tutorials\/(?:(?:[a-z0-9\-]+)\/(\d+)(?:\/\d+)?\/)?$/,
			link: 'http://www.phphulp.nl/php/tutorials/-/{$id}/'
		},
		Script: {
			namespace: 'scripts.script',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/script\/(?:[a-z0-9\-]+)\/(?:[a-z0-9\-]+)\/(\d+)\/$/,
			link: 'http://www.phphulp.nl/php/script/-/-/{$id}/'
		},
		ScriptCategory: {
			namespace: 'scripts.category',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/scripts\/(?:(?:[a-z0-9\-]+)\/(\d+)(?:\/\d+)?\/)?$/,
			link: 'http://www.phphulp.nl/php/scripts/-/{$id}/'
		},
		NewsItem: {
			namespace: 'news.item',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/nieuws\/(?:[a-z0-9\-]+)\/(\d+)\//,
			link: 'http://www.phphulp.nl/php/nieuws/-/{$id}/'
		},
		Book: {
			namespace: 'books.book',
			id: /^(?:http\:\/\/www\.phphulp\.nl)?(?:\/php)?\/boek\/(?:[a-z0-9\-]+)\/(\d+)\//,
			link: 'http://www.phphulp.nl/php/boek/-/{$id}/'
		}
	}
	
	Types.find = (function() {
		var index = {};

		forEach(Types, function(type, name) {
			if(typeof Types[name] != 'object') return;
			index[type.namespace] = Types[name];
		});

		return function find(namespace) {
			return index[namespace];
		}
	})();
	
	Types.identify = function(url, type) {
		var hit;
		
		if(type) {
			return (hit = url.match(type.id)) && hit[1]
				? {type: type, id: parseInt(hit[1])}
				: false;
		}
		else {
			for(var type in Types) {
				if(!Types.hasOwnProperty(type) || typeof Types[type] != 'object')
					continue;
			
				if((hit = url.match(Types[type].id)) && hit[1])
					return {type: Types[type], id: parseInt(hit[1])};
			}
		}
		return false;
	}
	
	Types.equal = function(left, right) {
		return left.type == right.type && left.id == right.id;
	}

	function _alwaysTrue() {
		return true;
	}
	
	function stackdump()
	{
		var stack = [], caller = arguments.callee.caller;
		
		while(caller) {
			stack.push({
				name:caller.name,
				arguments: array(caller.arguments)
			});
			caller = caller.caller;
		}
		
		return stack;
	}
	
	function getProperty(property, element)
	{
		/* Greasemonkey objecten uitpakken, want die zijn zo netjes ingepakt
		in folie dat je niet bij de properties zoals localStorage.length kan. */
		
		try {
			return element[property];
		} catch(e) {
			return element.wrappedJSObject[property];
		}
	}
	
	function apply(patch)
	{
		try {
			patch();
			return true;
		} catch(e) {
			/* Got'a catch 'em all! */
			console.log(e, e.lineNumber, e.stack);
			return false;
		}
	}
	
	function pick(elements, filter)
	{
		for(var i = 0; i < elements.length; ++i) {
			if(!filter || filter(elements[i]))
				return elements[i];
		}
		
		return null;
	}
	
	function text(element)
	{
		return element && element.firstChild
			? element.firstChild.data
			: '';
	}
	
	function css(element, attribute)
	{
		return element.style[attribute] ||
			document.defaultView.getComputedStyle(element, null)[attribute];
	}
	
	function date(date)
	{
		if(date instanceof Date)
			return date;
		
		var d = null;
		
		var i = function(value) {
			return value ? parseInt(value) : 0;
		}
		
		if(d = date.match(/^(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/))
			return new Date(d[3], d[2]-1, d[1], d[4], d[5], i(d[6]));
		
		if(d = date.match(/^(\d{4})[\/\.\-](\d{2})[\/\.\-](\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/))
			return new Date(d[1], d[2]-1, d[3], d[4], d[5], i(d[6]));
		
		return new Date(date);
	}
	
	function array(list) {
		return Array.prototype.slice.apply(list);
	}
	
	function iterable(entity) {
		// dit werkt niet in Stomme greasemonkey door XPCNativeWrapper
		//return entity instanceof NodeList || entity instanceof Array;
		return typeof entity.length != 'undefined';
	}
	
	function timeBetween(now, then)
	{
		var diff = then.getTime() - now.getTime();
		
		var r = function(n) { return Math.round(n); };
		
		var inFuture = diff > 0;
		
		diff = Math.abs(diff);
		
		var seconds = diff / 1000;
		var minutes = seconds / 60;
		var hours = minutes / 60;
		var days = hours / 24;
		var months = days / 30;
		var years = days / 365;
		
		var difference =
			seconds < 45 && r(seconds) + ' seconden' ||
			seconds < 90 && '1 minuut' ||
			minutes < 45 && r(minutes) + ' minuten' ||
			minutes < 90 && '1 uur' ||
			hours < 24 && r(hours) + ' uren' ||
			hours < 48 && '1 dag' ||
			days < 30 && r(days) + ' dagen' ||
			days < 60 && '1 maand' ||
			days < 365 && r(months) + ' maanden' ||
			r(years) + ' jaar';
		
		if(inFuture)
			return 'over ' + difference;
		else
			return difference + ' geleden';
	}
	
	function timeSince(then) {
		return timeBetween(new Date(), then);
	}
	
	function repeat(block, times) {
		while(--times >= 0)
			block();
	}
	
	function set(element, properties) {
		if(typeof element == 'array' || element instanceof NodeList) {
			return forEach(element, function(element) {
				set(element, properties);
			});
		}
		
		forEach(properties, function(value, key) {
			if(value instanceof Object) {
				if(value.toString !== Object.prototype.toString)
					value = value.toString();
				else if(typeof element[key] != 'undefined')
					return set(element[key], value);
			}
			element[key] = value;
		});
		
		return element;
	}
	
	function forEach(elements, check, block)
	{
		if (typeof block === 'undefined') {
			block = check;
			check = _alwaysTrue;
		}
		
		if(iterable(elements)) {
			for(var i = 0; i < elements.length; ++i) {
				if (check(elements[i], i))
					block(elements[i], i);
			}
		}
		else {
			for(var index in elements) {
				
				if(!elements.hasOwnProperty) {
					console.log(elements);
					throw Error('Elements has no hasOwnProperty method');
				}
				
				if(elements.hasOwnProperty(index) && check(elements[index], index)) {
					block(elements[index], index);
				}
			}
		}
		
		return elements;
	}
	
	function when(argument, block) {
		return argument ? block(argument) : null;
	}
	
	function on(event, object, block) {
		var callback = function(e) {
			var response = block(e);
			if(response === false)
				e.preventDefault();
		}
		
		object.addEventListener(event, callback, false);
		
		return callback;
	}
	
	// get an element if tagName is an id, otherwise create the element tagName.
	function element(tagName, properties) {
		if (tagName.charAt(0) == '#')
			return document.getElementById(tagName.substring(1));
		
		var el = document.createElement(tagName);
		if(properties) set(el, properties);
		return el;
	}
	
	function textNode(text) {
		return document.createTextNode(text);
	}
	
	function fragment(source) {
		var fragment = document.createDocumentFragment();
		
		if(source.constructor.name == 'Array')
			forEach(source, function(el) {
				if(el) append(el, fragment);
			});
		else
			while(source && source.hasChildNodes())
				append(source.firstChild, fragment);
		
		return fragment;
	}
	
	function elements(selector, node) {
		if(typeof node == 'undefined')
			node = document;
		
		return node.querySelectorAll(selector);
	}
	
	function matches(node, selector) {
		switch(selector.charAt(0)) {
			case '#':
				return !!(node.id && node.id == selector.substr(1));
			case '.':
				return !!(node.className
					&& node.className.length > 0
					&& new RegExp("(^|\\s)" + selector.substr(1) + "(\\s|$)").test(node.className));
			default:
				return !!(node.nodeName && node.nodeName == selector.toUpperCase());
		}
	}
	
	function last(elements) {
		return elements[elements.length - 1];
	}
	
	function next(selector, node) {
		while(node = node.nextSibling) {
			if(matches(node, selector))
				return node;
		}
		return false;
	}
	
	function previous(selector, node) {
		while(node = node.previousSibling) {
			if(matches(node, selector))
				return node;
		}
		return false;
	}
	
	function prepend(child, node) {
		node.insertBefore(child, node.firstChild);
		return child;
	}
	
	function append(child, node) {
		node.appendChild(child);
		return child;
	}
	
	function before(child, node) {
		node.parentNode.insertBefore(child, node);
		return child;
	}
	
	function after(child, node) {
		return node.nextSibling && before(child, node.nextSibling) || append(child, node);
	}
	
	function replace(current, replacement) {
		current.parentNode.replaceChild(replacement, current);
		return replacement;
	}
	
	function remove(node) {
		node.parentNode.removeChild(node);
		//node.ondestruct && node.ondestruct();
	}
	
	function clear(node) {
		while(node.firstChild)
			remove(node.firstChild);
	}
	
	function show(node) {
		node.style.display = 'block';
	}
	
	function hide(node) {
		node.style.display = 'none';
	}
	
	function isViewing(type) {
		return type.id.test(document.location.href);
	}
	
	function isViewingPreferences() {
		return document.location.pathname == '/voorkeuren/';
	}
	
	function id(type, url) {
		var hit = (url || document.location.href).match(type.id);
		return hit && parseInt(hit[1]) || null;
	}
	
	function link(object) {
		return object.type.link.replace(/\{\$id\}/, object.id);
	}
	
	function load(url, callback) {
		var request = new XMLHttpRequest();
		request.open('GET', url, true);
		request.send();
		
		request.onload = function() {
			parse(request.responseText);
		}
		
		var parse = function(html) {
			var container = element('div');
			container.innerHTML = html;
			callback(container);
		}
	}
	
	var EventEmitter = function(origin) {
		var listeners = [];
		
		return {
			fire: function() {
				for(var i = 0; i < listeners.length; ++i) {
					listeners[i].apply(origin, array(arguments));
				}
			},
			
			addListener: function(callback) {
				listeners.push(callback);
			},
			
			removeListener: function(callback) {
				listeners = listeners.filter(function filterListeners(listener) {
					return listener != callback;
				});
			}
		}
	}
	
	var Preferences = (function() {
		
		var prefix = 'preferences.';
		
		var emitter = EventEmitter();
		
		/*
		// Chrome heeft storage events nog niet geïmplementeerd
		window.addEventListener('storage', function(event) {
			try {
				emitter.fire(
					event.key.match(/^preferences\.([^]+)$/)[1],
					JSON.parse(event.newValue));
			} catch(e) {
				console.log(e, e.stack);
			}
		}, false);
		*/
		
		return {
			set: function(key, value)
			{
				localStorage.setItem(prefix+key, JSON.stringify(value));
				emitter.fire(key, value);
			},
			
			get: function(key, alternative)
			{
				try {
					return localStorage.getItem(prefix+key) !== null
						? JSON.parse(localStorage.getItem(prefix+key))
						: alternative;
				} catch(e) {
					return alternative;
				}
			},
			
			toggle: function(key)
			{
				Preferences.set(key, !Preferences.get(key));
			},
			
			addListener: emitter.addListener,
			removeListener: emitter.removeListener
		}
	})();
	
	var Favorites = (function() {
		
		var _favorites = [];
		
		var emitter = EventEmitter();
		
		var key = function(object) {
			return [object.type.namespace, object.id, 'favorited'].join('.');
		}
		
		var load = function() {
			if (!Preferences.get('imported_favorites', false))
				return importOld();
			
			var favorites = {};
			
			forEach(JSON.parse(localStorage.getItem('favorites')), function(favorite) {
				favorite.type = Types.find(favorite.type);
				favorite.link = link(favorite);
				favorite.favoritedOn = date(favorite.favoritedOn);
				favorites[key(favorite)] = favorite;
			});
			
			_favorites = favorites;
		}
		
		var save = function()
		{
			var favorites = {};
			
			forEach(_favorites, function(favorite) {
				favorites[key(favorite)] = {
					'id': favorite.id,
					'type': favorite.type.namespace,
					'title': favorite.title,
					'favoritedOn': favorite.favoritedOn
				};
			});
			
			localStorage.setItem('favorites', JSON.stringify(favorites));
		}
		
		var importOld = function() {
			var suffix = /\.favorited$/,
				list = {},
				idx = null;
		
			var decode = function(data) {
				var favorite = JSON.parse(data);
				favorite.type = Types.find(favorite.type);
				favorite.link = link(favorite);
				favorite.favoritedOn = date(favorite.favoritedOn);
				return favorite;
			}
		
			for(var i = getProperty('length', localStorage) - 1; i > 0; --i) {
				idx = localStorage.key(i);
				if(suffix.test(idx)) {
					try {
						var favorite = decode(localStorage.getItem(idx));
						list[key(favorite)] = favorite;
						localStorage.removeItem(idx);
					} catch(e) {/* Pokemon! */}
				}
			}
			
			_favorites = list;
			save();
			Preferences.set('imported_favorites', true);
		}
		
		load();

		return {
			add: function(object, title)
			{
				var favorite = {
					'type': object.type,
					'id': object.id,
					'title': title,
					'favoritedOn': new Date()
				};
				
				favorite.link = link(favorite);
				
				_favorites[key(favorite)] = favorite;
				save();
				emitter.fire(favorite);
			},
		
			remove: function(object)
			{
				delete _favorites[key(object)];
				save();
				emitter.fire(object);
			},
			
			isFavorited: function(object)
			{
				return !!_favorites[key(object)];
			},
		
			find: function(type)
			{
				var list = [];
				
				forEach(_favorites, function(favorite) {
					list.push(favorite);
				});
			
				list.sort(function compareFavorites(a, b) {
					return a.favoritedOn - b.favoritedOn;
				});
			
				return list;
			},
			
			cleanUp: function()
			{
				// TODO
			},
		
			addListener: emitter.addListener,
			removeListener: emitter.removeListener
		}
	})();
	
	var Content = (function() {
		
		var emitter = EventEmitter();
		
		var key = function(object, property) {
			return [object.type.namespace, object.id, property].join('.');
		}
		
		var legacy_read = function(object) {
			var data = localStorage.getItem(key(object, 'read'));
			
			var prototype = {
				lastVisited: null,
				lastUpdated: null,
				visits: 0
			};
			
			if(!data) return prototype;
			
			try {
				var entity = JSON.parse(data)
			} catch(e) {
				var entity = prototype;
			}
			
			if(entity.lastVisited !== null)
				entity.lastVisited = date(entity.lastVisited);
			
			if(entity.lastUpdated !== null)
				entity.lastUpdated = date(entity.lastUpdated);
				
			return entity;
		}
		
		var decode = function(datetime) {
			try {
				return datetime && date(JSON.parse(datetime));
			} catch(e) {
				return null;
			}
		}
		
		var encode = function(datetime) {
			return datetime && JSON.stringify(datetime);
		}
		
		return {
			markRead: function(object) {
				if(!object) {
					object = Types.identify(document.location.href);
					if(!object) return false
				}
				
				localStorage.setItem(key(object, 'lastRead'), encode(new Date()));
				
				emitter.fire(object);
			},
			
			lastRead: function(object) {
				var lastRead = localStorage.getItem(key(object, 'lastRead'));
				
				if(lastRead)
					return decode(lastRead);
				else
					return legacy_read(object).lastVisited;
			},
			
			markUpdated: function(object, lastUpdated) {
				localStorage.setItem(key(object, 'lastUpdated'), encode(lastUpdated));
				
				emitter.fire(object);
			},
			
			isUpdated: function(object) {
				var lastUpdated = decode(localStorage.getItem(key(object, 'lastUpdated')));
				var lastRead = decode(localStorage.getItem(key(object, 'lastRead')));
				var entity = legacy_read(object);
				
				lastUpdated = lastUpdated || entity.lastUpdated;
				lastRead = lastRead || entity.lastVisited;
				
				return !lastRead || lastUpdated > lastRead;
			},
			
			addListener: emitter.addListener,
			removeListener: emitter.removeListener
		}
	})();
	
	function Menu(id, title)
	{
		var menu = element('div');
		menu.className = 'menu_block';
		if(id) menu.id = id;
		
		var top = append(element('span'), menu);
		top.className = 'top';
		
		var item = append(element('div'), menu);
		item.className = 'item latest';
		
		var bottom = append(element('span'), menu);
		bottom.className = 'bottom';
		
		var content = append(element('div'), item);
		content.className = 'content';
		
		var header = append(element('h3'), content);
		append(textNode(title || 'PHPhulp'), header);
		
		var arrow = append(element('img'), header);
		arrow.src = 'data:image/png;base64,\
		iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJ\
		bWFnZVJlYWR5ccllPAAAAKRJREFUeNqckkELgkAQhWe0iFDJg+RF6NDv6df2q/SUFJF0sLfwViZY\
		V9iBDxn3vXF8rMp/1eAESnAAE3iBETy8SPncg5bCkcKJfclBru/B15s7mlTCpTzv7ErXiMEana7O\
		OeEJ3rJdTl/tuHPPl7eI4c5/bTOTkj9YM4gPJzMpyYrR9ssHLqAJTA+t2lCflt4HFOAYSdAZzmAG\
		Q9KN0JS79xNgAK6bJdz/0fLgAAAAAElFTkSuQmCC';
		
		var container = append(element('div'), content);
		
		header.style.marginBottom = 0;
		header.style.cursor = 'pointer';
		header.style.webkitUserSelect = 'none';
		header.style.position = 'relative'
		
		arrow.style.position = 'absolute';
		arrow.style.right = '0';
		arrow.style.top = '2px';
		arrow.style.webkitTransitionDuration = '0.25s';
		
		container.style.marginTop = '4px';
		container.style.overflow = 'hidden';
		container.style.webkitTransitionDuration = '0.25s';
		
		var prefId = [id, 'state'].join('.');
		
		on('click', header, function() {
			Preferences.set(prefId, Preferences.get(prefId) != 'closed'
				? 'closed'
				: 'open');
		});
		
		var open = function() {
			show(container);
		}
		
		var close = function() {
			hide(container);
		}
		
		var update = function() {
			var closed = Preferences.get(prefId) == 'closed';
			
			if(closed) {
				close()
			} else {
				open();
			}
			
			header.title = closed
				? 'Uitklappen'
				: 'Inklappen'
			
			arrow.style.webkitTransform = closed
				? 'rotate(0deg)'
				: 'rotate(-180deg)';
		}
		
		update();
		
		Preferences.addListener(update);
		
		menu.setTitle = function(title)
		{
			clear(header);
			append(textNode(title), header);
			append(arrow, header);
		}
		
		menu.addItem = function(options)
		{
			var title = append(element('h2'), container);

			title.style.height = '17px';
			title.style.overflow = 'hidden';
			title.style.textOverflow = 'ellipsis';
			title.style.whiteSpace = 'nowrap';
			
			var link = element('a');
			link.href = options.link;
			link.title = options.title;
			append(textNode(options.title), link);

			if(options.icon)
				append(options.icon, title);

			append(link, title);

			if(options.label)
				append(options.label, title);

			if(options.pubDate) {
				var timestamp = append(element('span'), container);
				timestamp.title = options.pubDate.toString();
				timestamp.className = 'greytalic';
				append(textNode('('+timeSince(options.pubDate)+')'), timestamp);
				append(element('br'), container);
			}
			
			if(options.description) {
				append(textNode(options.description), container);
			}
			
			if(options.separator) {
				var separator = append(element('div'), container);
				separator.className = 'separator';
			}
		}
		
		menu.append = function(node)
		{
			append(node, container);
		}
		
		menu.clear = function()
		{
			clear(container);
		}
		
		return menu;
	}
	
	function Bullet(object)
	{
		var bullet = element('span');
		append(textNode(Icons.Bullet), bullet);
		bullet.style.cursor = 'pointer';
		bullet.style.webkitUserSelect = 'none';
		bullet.style.display = 'none';
		bullet.style.marginRight = '0.5em';
		
		var update = function(source) {
			if(!Types.equal(source, object)) return;
			
			var unread = Content.isUpdated(object);
			
			bullet.title = unread
				? 'Markeer als gelezen'
				: 'Markeer als ongelezen';
			
			bullet.style.display = unread
				? 'inline'
				: 'none';
		}
		
		update(object);
		
		Content.addListener(update);
		
		bullet.onclick = function() {
			Content.markRead(object);
		}
		
		bullet.ondestruct = function() {
			Content.removeListener(update);
		}
		
		return bullet;
	}
	
	function Star(object, title)
	{
		var star = element('span');
		append(textNode(Icons.WhiteStar), star);
		star.style.paddingLeft = '0.5em';
		star.style.webkitUserSelect = 'none';
		star.style.cursor = 'pointer';
		
		var update = function(source) {
			if(!Types.equal(source, object)) return;
			
			var favorite = Favorites.isFavorited(object);
			
			replace(star.firstChild, textNode(favorite
				? Icons.BlackStar
				: Icons.WhiteStar));
			
			star.title = favorite
				? 'Maak niet langer favoriet'
				: 'Maak favoriet';
			
			star.className = favorite
				? 'favorite-star favorited'
				: 'favorite-star';
			
			star.style.color = favorite
				? Colors.Blue
				: Colors.Grey;
		}
		
		update(object);
		
		Favorites.addListener(update);
		
		on('mouseover', star, function() {
			replace(star.firstChild, textNode(Favorites.isFavorited(object)
				? Icons.WhiteStar
				: Icons.BlackStar));
		});
		
		on('mouseout', star, function() {
			replace(star.firstChild, textNode(Favorites.isFavorited(object)
				? Icons.BlackStar
				: Icons.WhiteStar));
		});
		
		on('click', star, function() {
			if(Favorites.isFavorited(object))
				Favorites.remove(object)
			else
				Favorites.add(object, title);
			
			return false;
		});
		
		/*
		star.ondestruct = function() {
			Favorites.removeListener(update);
		}
		*/
		
		return star;
	}
	
	function patchSidebar()
	{
		var sidebar = element('#sidebar');
		// arrays van maken zodat het niet live nodeList lijstjes worden.
		var items   = array(elements('.item', sidebar));
		
		var map = {
			'Mijn menu': 'menu_mijn_menu',
			'Laatste forum berichten': 'menu_recent_posts',
			'Recente reacties': 'menu_recent_comments',
			'Laatste PHP scripts': 'menu_recent_scripts',
			'Laatste PHP tutorials': 'menu_recent_tutorials',
			'Actief op PHPhulp': 'menu_recent_users'
		}
		
		sidebar.add = function(menu, offset) {
			var menu_blocks = elements('.menu_block', sidebar);
			before(menu, menu_blocks[offset || 0]);
		}
		
		forEach(items, function(item, i) {
			var top = previous('.top', item),
				bottom = next('.bottom', item),
				header = pick(elements('h3', item)),
				id = null,
				title = null;
			
			if(header) {
				title = text(header);
				id = map[title];
				remove(header);
			}
			
			var menu = Menu(id, title);
			
			var content, link;
			
			if(content = pick(elements('.content', item))) {
				while(content.firstChild) {
					menu.append(content.firstChild);
				}
				
				when(next('a', content), function(link) {
					repeat(function() { menu.append(element('br')) }, 2);
					menu.append(link);
				});
			}
			
			else if(content = pick(elements('.loginoptions', item))) {
				menu.append(content);
			}
			
			else return;
			
			remove(top);
			remove(item);
			remove(bottom);
			
			append(menu, sidebar);
		});
		
		element('#menu_recent_posts').setTitle('Recente topics');
	}
	
	function appendFavoriteStar()
	{
		var favoriteEnabledTypes = [
			Types.ForumTopic,
			Types.ForumCategory,
			Types.User,
			Types.Script,
			Types.ScriptCategory,
			Types.Tutorial,
			Types.TutorialCategory,
			Types.NewsItem,
			Types.Book
		];

		var object = Types.identify(document.location.href);
		
		if(favoriteEnabledTypes.indexOf(object.type) == -1)
			return;
		
		var title = pick(elements('#content h1'));
		
		var star = Star(object, text(title));
		
		append(star, title);
	}
	
	function appendFavoritesMenu()
	{
		var menu = Menu('menu_favorites', 'Favorieten');
		element('#sidebar').add(menu, 1);
	
		var update = function() {
			menu.clear();
			forEach(Favorites.find(), function(favorite) {
				menu.addItem({
					title: favorite.title,
					link: favorite.link,
					icon: Bullet(favorite),
					label: Star(favorite, favorite.title)
				});
			})
		}
		
		Favorites.addListener(update);
		
		update();
	}
	
	function markPosts(forum)
	{
		if(!forum)
			forum = pick(elements('#content .forum_skalet'));
		
		if(!forum) return;
		
		var lastRead = Content.lastRead({
						type: Types.ForumTopic,
						id: id(Types.ForumTopic)
					   });
		
		forEach(elements('.forum_msg_author', forum), function(authorNode)
		{
			var pubDateNode = pick(elements('span', authorNode),
				function(span) { return span.className == 'forum_grey' });
			
			var pubDate = date(text(pubDateNode));
			
			replace(pubDateNode.firstChild, textNode(timeSince(pubDate)));
			
			if(!lastRead || pubDate > lastRead) {
				var postNode = authorNode.nextSibling;
				postNode.style.borderLeft = '5px solid '+Colors.Blue;
				postNode.style.width = '524px';
			}
		});
	}
	
	function markTopics()
	{
		var category = pick(elements('.php_forum_overview'));
		
		if(!category) return;
		
		forEach(elements('tr', category), function(row) {
			
			if(elements('td', row).length  != 6) return;
			
			var iconCell = pick(elements('.list_icon', row))
			
			var dateCell = pick(elements('.list_date', row));
			
			var titleCell = pick(elements('.list_title', row));
			
			var topicLink = pick(elements('a', titleCell));
			
			var topicTitle = elements('b', topicLink).length
				? text(pick(elements('b', topicLink)))
				: text(topicLink);
			
			var topicId = id(Types.ForumTopic, topicLink.href);
			
			var topic = {
				type: Types.ForumTopic,
				id: topicId
			}
			
			append(Star(topic, topicTitle), titleCell);
			
			Content.addListener(function(source) {
				if(!Types.equal(source, topic)) return;
				
				iconCell.style.background = Content.isUpdated(topic)
					? Colors.Blue
					: Colors.LightBlue;
			});
			
			Content.markUpdated(topic, date(text(pick(elements('span', dateCell)))));
		});
	}
	
	function markCategories()
	{
		var forum = pick(elements('.php_forum_overview'));
		
		if(!forum) return;
		
		forEach(elements('tr', forum), function(row) {
			if(!(/^forum_catrow_\d+$/.test(row.id))) return;
			
			var categoryLink = pick(elements('a', row));
			
			var category = Types.identify(categoryLink.href, Types.ForumCategory);
			
			after(Star(category, text(categoryLink)), categoryLink);
		})
	}
	
	function appendRecentMenu()
	{
		var request = new XMLHttpRequest();
		request.open('GET',
			Preferences.get('lounge_topics_in_recent_menu', true)
				? 'http://www.phphulp.nl/rss-feed/forum.php?lounge=1'
				: 'http://www.phphulp.nl/rss-feed/forum.php', true);
		request.onload = function()
		{
			var menu = element('#menu_recent_posts');
			
			menu.clear();
			
			forEach(elements('item', request.responseXML), function(item)
			{
				var link = text(pick(elements('link', item)));
				
				var title = text(pick(elements('title', item)));
				
				var lastUpdated = date(text(pick(elements('pubDate', item))));
				
				var topic = Types.identify(link, Types.ForumTopic);
				
				var label = document.createDocumentFragment();
				
				Content.markUpdated(topic, lastUpdated);
				
				menu.addItem({
					title: title,
					link: link,
					pubDate: lastUpdated,
					icon: fragment([
						Bullet(topic),
						when(pick(elements('enclosure', item)), function(icon) {
							return element('img', {'src':icon.getAttribute('url'), 'style':{'marginRight':'0.5em'}}); 
						})
					]),
					label: Star(topic, title)
				});
			})
		}
		request.send();
	}
	
	function insertSearchPlaceholder()
	{
		forEach(elements('input'), 
			function(input) { return input.name == 'q' },
			function(input) { input.placeholder = 'Zoeken' });
	}
	
	function fuckAds()
	{
		// de promo link onder de navigatie boven, naast het zoekvakje
		when(element('#promo'), remove);
		
		when(element('#delcomment'), hide);
		
		// de, jawel, tower ad
		when(element('#push'), function(push) {
			var tower_ad = next('div', push);
			if(tower_ad && css(tower_ad, 'position') == 'absolute')
				remove(tower_ad);
		});
		
		// de adsl links
		forEach(elements('#extras > a[href^="http://"]'), remove);

		// de google berichtjes
		forEach(
			elements('.forum_msg_content'),
			function(msg) {
				return text(msg) == 'De volgende links passen bij dit bericht:';
			},
			function(msg) {
				hide(previous('.forum_msg_author', msg));
				hide(msg);
				hide(next('.clearit', msg));
			});
	}
	
	function singleShotForms()
	{
		forEach(elements('form'), function(form) {
			form.onsubmit = function() {
				forEach(elements('input', form), function(field) {
					if(field.type == 'submit') {
						field.disabled = true;
						setTimeout(function() {
							field.disabled = false;
						}, 200);
					}
				});
			}
		});
	}
	
	function checkForUpdates()
	{
		var notify = function() {
			var container = element('div');
			container.style.textAlign = 'center';
		
			var update = append(element('a'), container);
			append(textNode('Update!'), update);
		
			update.href = 'http://phphulp.ikhoefgeen.nl/phphulp.user.js';
			update.target = '_blank';
		
			set(update.style, {
				cursor: 'pointer',
				fontSize: '11px',
				textShadow: '0 1px white'
			});
		
			update.onmouseover = function() {
				update.style.color = 'black';
			}
		
			update.onmouseout = function() {
				update.style.color = 'grey';
			}
		
			update.onmouseout();
		
			append(container, element('#sidebar'));
		}
		
		notify();
	}
	
	function patchCSS(topic)
	{
		if(!topic) {
			var style = append(element('style'), pick(elements('head')));
			append(textNode('.forum_msg_author h3 { \
				color: #465CB1; \
				overflow-x: hidden; \
				text-overflow:ellipsis; \
				white-space: nowrap; \
			}'), style);
			
			topic = document;
		}
		
		forEach(elements('.Quote', topic), function(quote) {
			set(quote.parentNode.style, {
				borderLeft: '4px solid silver',
				padding: '4px'
			});

			set(quote.style, {
				border: 'none',
				padding: '0'
			});
		});
	}
	
	function watchForUpdates()
	{
		var title = document.title;
		
		var current = Types.identify(document.location.href);
		
		var topic = pick(elements('.forum_skalet', element('#content')));
		
		var notice = before(element('p'),
			   next('h2', last(elements('.forum_msg_author')))
			|| next('p', last(elements('.forum_msg_author'))));
		
		hide(notice);
		
		var s = notice.style;
		s.background = Colors.Blue;
		s.padding = '1em';
		s.color = 'white';
		s.borderRadius = '3px';
		
		var loadNewPosts = function()
		{
			clear(notice);
			append(textNode('Nieuwe reacties laden…'), notice);
			notice.style.cursor = 'default';
			notice.onclick = null;
			
			load(link(current), function(html) {
				var buffer = element('div'); // geen fragment, want dan werken
				// functies zoals elements() er niet op. markPosts en patchCSS
				// gebruiken die functies.
				
				var lastOpened = Content.lastRead(current);
				
				forEach(elements('.forum_msg_author', html), function(author) {
					var pubDateNode = pick(elements('span', author),
						function(span) { return span.className == 'forum_grey' });
					var pubDate = date(text(pubDateNode));
					
					if(pubDate < lastOpened) return;
					
					if(spam(author) && Preferences.get('disable_ads')) return;
					
					var message = next('div', author);
					var clear = next('div', message);
					
					append(author, buffer);
					append(message, buffer);
					append(clear, buffer);
				});
				
				markPosts(buffer);
				
				if(Preferences.get('enable_css', true))
					patchCSS(buffer);
				
				before(fragment(buffer), notice);
				
				Content.markRead(current);
			})
		}
		
		var update = function(source) {
			if(!Types.equal(source, current))
				return;
			
			if(Content.isUpdated(current)) {
				clear(notice);
				append(textNode('Er zijn nieuwe reacties'), notice);
				
				notice.style.cursor = 'pointer';
				notice.onclick = function() {
					loadNewPosts();
					return false;
				}
				
				show(notice);
				
				document.title = Icons.Bullet + ' ' + title;
			}
			else {
				hide(notice);
				
				document.title = title;
			}
		}
		
		Content.addListener(update);
	}
	
	function spam(authorNode) {
		var link = pick(elements('a', authorNode))
		var linkedUser = Types.identify(link.href, Types.User);
		
		if(!linkedUser) return;
		
		var pubDate = date(text(pick(elements('span', authorNode),
			function(span) { return span.className == 'forum_grey' })));
		
		if(!pubDate) return;
		
		return Math.abs(pubDate - new Date()) < 2000 // Spam posts hebben de
			// pubdate van pageload, dus stel dat onload 2 seconden later vuurt
			// dan zou dit nog moeten werken.
			&& linkedUser.id == 10; // PHP Hulp gebruiker.
	}
	
	function compat()
	{
		var errors = [];
		
		if(new Date(JSON.parse(JSON.stringify(new Date()))).toString() == 'Invalid Date') {
			console.log('Date cant parse the result of JSON.stringify (known bug in Opera 10.53/Mac): Patched date()');
			var _date = date;
			date = function(string)
			{
				var d = null;
				
				if(d = string.match(/^\"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z\"$/))
					return new Date(Date.UTC(d[1], d[2]-1, d[3], d[4], d[5], d[6]));
				else
					return _date(string);
			}
		}
	}
	

	function debugMenu()
	{
		var menu = element('#extras');
		
		var fireEvent = append(element('a', {'href':'#'}), menu);
		append(textNode('[Content.markUpdated]'), fireEvent);
		append(element('br'), menu);

		fireEvent.onclick = function() {
			var current = Types.identify(document.location.href);
			Content.markUpdated({
				'type': Types.ForumTopic,
				'id': parseInt(prompt('id', current.id))
			}, new Date());
			return false;
		}
		
		var reloadRecent = append(element('a', {'href':'#'}), menu);
		append(textNode('Update recent menu'), reloadRecent);
		append(element('br'), menu);
		
		reloadRecent.onclick = function() {
			appendRecentMenu();
			return false;
		}
	}
	
	function watchPreferences()
	{
		var preferences = pick(elements('form'), function(form) {
			return form.action == '/voorkeuren/';
		});
		
		var lounge_toggle = pick(elements('input', preferences), function(input) {
			return input.name == 'forum_koffiehoek';
		});
		
		var userscript_preferences = before(element('fieldset'), last(elements('fieldset', preferences)));
		append(textNode('PHPHulp++ opties'), append(element('legend'), userscript_preferences));
		userscript_preferences.style.lineHeight = '2.2em';
		
		var recent_menu_toggle = append(element('input', {'type':'checkbox', 'checked': Preferences.get('enable_recent_menu', true)}), userscript_preferences);
		append(textNode(' Vervang "Recente topics" menu door RSS feed en ververs iedere 2 minuten'), userscript_preferences);
		
		append(element('br'), userscript_preferences);
		
		var disable_ads_toggle = append(element('input', {'type':'checkbox', 'checked':Preferences.get('disable_ads', false)}), userscript_preferences);
		append(textNode(' Verberg advertenties onder het menu en binnen de topics'), userscript_preferences);
		
		append(element('br'), userscript_preferences);
		
		var enable_css_toggle = append(element('input', {'type':'checkbox', 'checked':Preferences.get('enable_css', true)}), userscript_preferences);
		append(textNode(' Gebruik extra CSS regels voor quotes en namen in binnen de topics'), userscript_preferences);
		
		append(element('br'), userscript_preferences);
		
		var enable_debug_menu_toggle = append(element('input', {'type':'checkbox', 'checked':Preferences.get('enable_debug_menu', false)}), userscript_preferences);
		append(textNode(' Toon debug menu (onder "extra\'s" onderaan de pagina)'), userscript_preferences);
		
		on('submit', preferences, function() {
			Preferences.set('enable_recent_menu', recent_menu_toggle.checked);
			Preferences.set('disable_ads', disable_ads_toggle.checked);
			Preferences.set('enable_css', enable_css_toggle.checked);
			Preferences.set('enable_debug_menu', enable_debug_menu_toggle.checked);
			if(lounge_toggle)
				Preferences.set('lounge_topics_in_recent_menu', lounge_toggle.checked);
		});
	}
	
	compat();
	
	// Als de sidebar niet eens bestaat, dan zal dit wel niet een goeie pagina zijn
	if(!apply(patchSidebar)) return;
	
	if(isViewing(Types.ForumTopic)) {
		apply(markPosts);
		apply(watchForUpdates);
	}
		
	else if(isViewing(Types.ForumCategory))
		apply(markTopics);
	
	else if(isViewing(Types.Forum))
		apply(markCategories);
	
	else if(isViewingPreferences())
		apply(watchPreferences);
	
	Content.markRead();
	
	apply(appendFavoriteStar);
	
	apply(appendFavoritesMenu);
	
	if(Preferences.get('enable_debug_menu', false))
		apply(debugMenu);
	
	if(Preferences.get('enable_recent_menu', true))
		apply(appendRecentMenu) && setInterval(appendRecentMenu, 120 * 1000);
	
	if(Preferences.get('disable_ads', true))
		apply(fuckAds);
	
	if(Preferences.get('enable_css', true))
		apply(patchCSS);
	
	apply(insertSearchPlaceholder);
	
	apply(singleShotForms);
})();