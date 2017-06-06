/**
 * Video Calls integration for eXo Platform.
 */
(function($) {
	"use strict";
	
	// ******** Utils ********

	/** For debug logging. */
	var objId = Math.floor((Math.random() * 1000) + 1);
	var logPrefix = "[videocall_" + objId + "] ";
	var log = function(msg, e) {
		if ( typeof console != "undefined" && typeof console.log != "undefined") {
			console.log(logPrefix + msg);
			if (e && typeof e.stack != "undefined") {
				console.log(e.stack);
			}
		}
	};

	// Returns the version of Windows Internet Explorer or a -1
	// (indicating the use of another browser).
	var getIEVersion = function() {
		var rv = -1;
		// Return value assumes failure.
		if (navigator.appName == "Microsoft Internet Explorer") {
			var ua = navigator.userAgent;
			var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
			if (re.exec(ua) != null)
				rv = parseFloat(RegExp.$1);
		}
		return rv;
	};
	
	var pageBaseUrl = function(theLocation) {
		if (!theLocation) {
			theLocation = window.location;
		}

		var theHostName = theLocation.hostname;
		var theQueryString = theLocation.search;

		if (theLocation.port) {
			theHostName += ":" + theLocation.port;
		}

		return theLocation.protocol + "//" + theHostName;
	};

	var getPortalUser = function() {
		return eXo.env.portal.userName;
	};

	var decodeString = function(str) {
		if (str) {
			try {
				str = str.replace(/\+/g, " ");
				str = decodeURIComponent(str);
				return str;
			} catch(e) {
				log("WARN: error decoding string " + str + ". " + e, e);
			}
		}
		return null;
	}

	var encodeString = function(str) {
		if (str) {
			try {
				str = encodeURIComponent(str);
				return str;
			} catch(e) {
				log("WARN: error decoding string " + str + ". " + e, e);
			}
		}
		return null;
	};

	// ******** UI utils **********

	/**
	 * Open pop-up.
	 */
	var popupWindow = function(url) {
		var w = 650;
		var h = 400;
		var left = (screen.width / 2) - (w / 2);
		var top = (screen.height / 2) - (h / 2);
		return window.open(url, 'contacts', 'width=' + w + ',height=' + h + ',top=' + top + ',left=' + left);
	};
	
	// UI messages
	// Used to show immediate notifications in top right corner.
	// This functionality requires pnotifyJQuery and jqueryui CSS.

	var NOTICE_WIDTH = "380px";
  
  var isIOS = /iPhone|iPod|iPad/.test(navigator.userAgent);
  var isAndroid = /Android/.test(navigator.userAgent);
  var isWindowsMobile = /IEmobile|WPDesktop|Windows Phone/i.test(navigator.userAgent) || /WM\s*\d.*.Edge\/\d./i.test(navigator.userAgent);
  
  var CACHE_LIVETIME = 30000;
  
	/**
	 * Show notice to user. Options support "icon" class, "hide", "closer" and "nonblock" features.
	 */
	var showNotice = function(type, title, text, options) {
		var noticeOptions = {
			title : title,
			text : text,
			type : type,
			icon : "picon " + ( options ? options.icon : ""),
			hide : options && typeof options.hide != "undefined" ? options.hide : false,
			delay : options && typeof options.delay != "undefined" ? options.delay : undefined,
			closer : options && typeof options.closer != "undefined" ? options.closer : true,
			sticker : false,
			opacity : .85,
			shadow : true,
			width : options && options.width ? options.width : NOTICE_WIDTH,
			nonblock : options && typeof options.nonblock != "undefined" ? options.nonblock : false,
			nonblock_opacity : .45,
			addclass : options && options.addclass ? options.addclass : "",
			cornerclass : options && options.cornerclass ? options.cornerclass : "",
			after_init : function(pnotify) {
				if (options && typeof options.onInit == "function") {
					options.onInit(pnotify);
				}
			}
		};
		return $.pnotify(noticeOptions);
	};

	/**
	 * Show error notice to user. Error will stick until an user close it.
	 */
	var showError = function(title, text, onInit) {
		return showNotice("error", title, text, {
			icon : "picon-dialog-error",
			hide : false,
			delay : 0,
			onInit : onInit
		});
	};

	/**
	 * Show info notice to user. Info will be shown for 8sec and hidden then.
	 */
	var showInfo = function(title, text, onInit) {
		return showNotice("info", title, text, {
			hide : true,
			delay : 8000,
			icon : "picon-dialog-information",
			onInit : onInit
		});
	};

	/**
	 * Show warning notice to user. Info will be shown for 8sec and hidden then.
	 */
	var showWarn = function(title, text, onInit) {
		return showNotice("exclamation", title, text, {
			hide : true,
			delay : 30000,
			icon : "picon-dialog-warning",
			onInit : onInit
		});
	};
	
	/**
	 * Show warning notice bar to user. Info will be shown for 8sec and hidden then.
	 */
	var showWarnBar = function(title, text, onInit) {
		return showNotice("exclamation", title, text, {
			hide : false,
			delay : 30000,
			icon : "picon-dialog-warning",
			width : "100%",
			addclass : "stack-bar-top",
      cornerclass : "",
			onInit : onInit
		});
	};

	// ******** REST services ********
	var prefixUrl = pageBaseUrl(location);

	var initRequest = function(request) {
		var process = $.Deferred();

		// stuff in textStatus is less interesting: it can be "timeout",
		// "error", "abort", and "parsererror",
		// "success" or smth like that
		request.fail(function(jqXHR, textStatus, err) {
			if (jqXHR.status != 309) {
				// check if response isn't JSON
				var data;
				try {
					data = $.parseJSON(jqXHR.responseText);
					if ( typeof data == "string") {
						// not JSON
						data = jqXHR.responseText;
					}
				} catch(e) {
					// not JSON
					data = jqXHR.responseText;
				}
				// in err - textual portion of the HTTP status, such as "Not
				// Found" or "Internal Server Error."
				process.reject(data, jqXHR.status, err, jqXHR);
			}
		});
		// hacking jQuery for statusCode handling
		var jQueryStatusCode = request.statusCode;
		request.statusCode = function(map) {
			var user502 = map[502];
			if (!user502) {
				map[502] = function() {
					// treat 502 as request error also
					process.fail("Bad gateway", 502, "error");
				};
			}
			return jQueryStatusCode(map);
		};

		request.done(function(data, textStatus, jqXHR) {
			process.resolve(data, jqXHR.status, textStatus, jqXHR);
		});

		request.always(function(data, textStatus, errorThrown) {
			var status;
			if (data && data.status) {
				status = data.status;
			} else if (errorThrown && errorThrown.status) {
				status = errorThrown.status;
			} else {
				status = 200;
				// what else we could to do
			}
			process.always(status, textStatus);
		});

		// custom Promise target to provide an access to jqXHR object
		var processTarget = {
			request : request
		};
		return process.promise(processTarget);
	};

	function Cache() {
		var cache = {};
		var locks = {};
		
		this.put = function(key, value) {
			cache[key] = value;
			setTimeout(function() {
				cache[key] = null;
  		}, CACHE_LIVETIME);
		};
		
		this.get = function(key) {
			// TODO do we need this check?
			if (cache.hasOwnProperty(key)) {
				return cache[key];
			} else {
				return null;
			}
		};
		
		this.remove = function(key) {
			cache[key] = null;
		};
		
		this.lock = function(key, worker) {
			locks[key] = worker;
		};
		
		this.locked = function(key) {
			if (locks.hasOwnProperty(key)) {
				return locks[key];
			} else {
				return null;
			}
		};
		
		this.unlock = function(key) {
			locks[key] = null;
		};
	}
	
	var getCached = function(key, cache, getFunc) {
		var res = cache.locked(key);
		if (res) {
			return res;
		}
		var worker = $.Deferred();
		cache.lock(key, res = worker.promise());
		var cached = cache.get(key);
		if (cached) {
			cache.unlock(key);
			worker.notify("CACHED " + key);
			worker.resolve(cached, "cached");
  	} else if (getFunc) {
  		var unlock = true;
  		var get = getFunc(key);
  		get.done(function(data, status, textStatus, jqXHR) {
  			cache.put(key, data);
  			cache.unlock(key);
  			unlock = false;
  			worker.resolve(data, status, textStatus, jqXHR);
	  	});
  		get.fail(function(data, status, err, jqXHR) {
  			cache.unlock(key);
  			unlock = false;
  			worker.reject(data, status, err, jqXHR);
  		});
  		get.always(function() {
  			if (unlock) {
  				// unlock again here - for a case if will not do in done/fail :)
  				cache.unlock(key); 
  			}
  		});
  	} else {
  		cache.unlock(key);
  		worker.notify("NOT FOUND " + key + ". Getter function not provided.");
  		worker.reject("Not found: " + key);
  	}
  	return res;
	};
	
	var cachedUsers = new Cache();
	var getUserInfoRequest = function(userName) {
		var request = $.ajax({
			async : true,
			type : "GET",
			url : prefixUrl + "/portal/rest/videocalls/user/" + userName
		});
		return initRequest(request);
	};
	var getUserInfo = function(userName) {
		return getCached(userName, cachedUsers, getUserInfoRequest);
	};

	/** @Deprecated TODO not yet used */
	var getUsersInfoRequest = function(names) {
		var request = $.ajax({
			async : true,
			type : "GET",
			url : prefixUrl + "/portal/rest/videocalls/users",
			data : {
				names : names
			}
		});
		return initRequest(request);
	};
	var getUsersInfo = function(names) {
		// TODO get by one user using local cache or get all from the server, or get all not cached from the server?
		// 1. get by one user using local cache
		var all = $.Deferred();
		var users = [];
		var workers = [];
		for (var i=0; i<names.length; i++) {
			var uname = names[i];
			var get = getCached(userName, cachedUsers, getUsersInfoRequest);
			get.done(function(u) {
				users.push(u);
			});
			workers.push(get);
		}
		$.when.apply($, workers).always(function() {
			all.resolve(users);
		});
		return all.promise();
	};

	var cachedSpaces = new Cache();
	var getSpaceInfoReq = function(spaceName) {
		var request = $.ajax({
			async : true,
			type : "GET",
			url : prefixUrl + "/portal/rest/videocalls/space/" + spaceName
		});
		return initRequest(request);
	};
	var getSpaceInfo = function(spaceName) {
		return getCached(spaceName, cachedSpaces, getSpaceInfoReq);
	};

	var serviceGet = function(url, data) {
		var request = $.ajax({
			async : true,
			type : "GET",
			url : url,
			dataType : "json",
			data : data ? data : {}
		});
		return initRequest(request);
	};
	
	var prepareUser = function(user) {
		user.title = user.firstName + " " + user.lastName;
	};
	
	/**
	 * VideoCalls core class.
	 */
	function VideoCalls() {

		// ******** Context ********
		var currentUser, currentSpace;
		
		// Registered providers
		var providers = [];

		/**
		 * Add call button to given target element.
		 */
		var addCallButton = function($target, context) {
			var initializer = $.Deferred();
			if ($target.length > 0) {
				// We need deal with non consecutive asynchronous calls to this method,
				// 1) use only currently available providers - froze the state
				var addProviders = providers.slice();
				if (addProviders.length > 0) {
					var buttonClass = "startCallButton";
					var providerFlag = "hasProvider_";
					var contextName = (context.spaceName ? context.spaceName : (context.roomTitle ? context.roomTitle : context.userName));
					// 2) if already calling, then need wait for previous call completion and then re-call this method 
					var prevInitializer = $target.data("callbuttoninit");
					if (prevInitializer) {
						log(">>> addCallButton > init WAIT " + contextName + " providers: " + addProviders.length);
						prevInitializer.always(function() {
							log(">>> addCallButton > init RESUMED " + contextName + " providers: " + addProviders.length);
							addCallButton($target, context).done(function($container) {
								initializer.resolve($container);
							}).fail(function(err) {
								initializer.reject(err);
							});
						});
					} else {
						$target.data("callbuttoninit", initializer);
						log(">>> addCallButton > init " + contextName + " providers: " + addProviders.length);
						initializer.always(function() {
							$target.removeData("callbuttoninit");
							log("<<< addCallButton < init " + contextName + " providers: " + addProviders.length);
						});
						// Do the main work here
						var $container = $target.find(".callButtonContainer");
						var $dropdown = $container.find(".dropdown-menu");
						var newDropdown = false;
						if ($container.length == 0) {
							// TODO May 22 2017: btn-group removed
							$container = $("<div style='display: none;' class='callButtonContainer'></div>");
							$target.append($container);
						} else if ($dropdown.length == 0) { 
							if ($container.find("." + buttonClass).length > 0) {
								$dropdown = $("<ul class='dropdown-menu'></ul>");
								newDropdown = true;
							} // else, need add first & default button (see in addProviderButton())
						}
						var workers = [];
						var buttons = [];
						function addProviderButton(provider, button) {
							log(">>> addCallButton > adding > " + contextName + "(" + provider.getTitle() + ") for " + context.currentUser.name);
							// need do this in a function to keep worker variable in the scope of given button when it will be done 
							var bworker = $.Deferred();
							button.done(function($button) {
								// TODO reorder buttons in business priority 
								if ($dropdown.length > 0) {
									// add in dropdown
									log(">>> addCallButton > add in dropdown > " + contextName + "(" + provider.getTitle() + ") for " + context.currentUser.name);
									$button.addClass(buttonClass);
									var $li = $("<li></li>");
									$li.append($button)
									$dropdown.append($li);	
								} else {
									// add first & default button
									log(">>> addCallButton > add first & default button > " + contextName + "(" + provider.getTitle() + ") for " + context.currentUser.name);
									$button.addClass("btn " + buttonClass); // btn btn-primary actionIcon 
									$container.append($button);
									$dropdown = $("<ul class='dropdown-menu'></ul>");
									newDropdown = true;
								}
								buttons.push($button);
								log("<<< addCallButton DONE < " + contextName + "(" + provider.getTitle() + ") for " + context.currentUser.name);
							});
							button.fail(function(msg) {
								log("<<< addCallButton CANCELED < " + contextName + "(" + provider.getTitle() + ") for " + context.currentUser.name + ": " + msg);
							});
							button.always(function() {
								// even if was fail, we treat it as canceled and mark the provider
								$container.data(providerFlag + provider.getType(), true);
								// for the below $.when's always callback we need resolve all workers independently succeeded or failed 
								bworker.resolve();
							});
							workers.push(bworker.promise());
						}
						// we have an one button for each provider
						log(">>> addCallButton > " + contextName + " for " + context.currentUser.name + " providers: " + addProviders.length);
						for (var i = 0; i < addProviders.length; i++) {
							var p = addProviders[i];
							log(">>> addCallButton > next provider > " + contextName + "(" + p.getTitle() + ") for " + context.currentUser.name + " providers: " + addProviders.length);
							if ($container.data(providerFlag + p.getType())) {
								log("<<< addCallButton DONE (already) < " + contextName + "(" + p.getTitle() + ") for " + context.currentUser.name);
							} else {
								var b = p.callButton(context);
								addProviderButton(p, b);
							}
						}
						if (workers.length > 0) {
							$.when.apply($, workers).always(function() {
								if (newDropdown && $dropdown.children().length > 0) {
									var $toggle = $("<button class='btn dropdown-toggle' data-toggle='dropdown'>" + 
											"<i class='uiIconMiniArrowDown uiIconLightGray'></i></span></button>");
									$container.append($toggle);
									$container.append($dropdown);
								}
								if (buttons.length > 0) {
									var $allButtons = $container.find("." + buttonClass);
									if ($allButtons.length > 1) {
										// ensure first button of all is a default one (for CSS)
										var $firstButon = $allButtons.first();
										if (!$firstButon.hasClass("defaultCallButton")) {
											$firstButon.addClass("defaultCallButton");
										}
									}
									$container.show();
									initializer.resolve($container);
								} else {
									initializer.reject("Nothing added");
								}
			        });
						} else {
							initializer.reject("Nothing to add");
						}
					}
				} else {
					initializer.reject("No providers");
				}	
			} else {
				initializer.reject("Target not found");
			}
			return initializer.promise();
		};
		
		/**
		 * TODO a placeholder for Chat initialization
		 */
		var initChat = function() {
			var $chat = $("#chat-application");
			// chatApplication is a global on chat app page
			if (typeof(chatApplication) == "object" && chatApplication && $chat.length > 0) {
				setTimeout(function() {
				log(">> initChat " + chatApplication.username);
				var roomId = chatApplication.targetUser; //$roomTitle.find("#chat-room-detail-fullname");
				var roomTitle = chatApplication.targetFullname;
				var isGroup = roomId.startsWith("team-"); //$teamDropdown.is(":visible");
				var $roomTitle = $chat.find("#room-detail");
				if (roomId) {
					var $teamDropdown = $roomTitle.find(".chat-team-button-dropdown");
					if ($teamDropdown.length > 0) {
						var $wrapper = $("<div class='callButtonContainerWrapper' style='display: none;'></div>");
						$teamDropdown.before($wrapper);
						
						var roomUsers = [];
						var chatContext = function(roomName) {
							var context = {
								currentUser : currentUser,
								roomId : roomId,
								roomTitle : roomTitle,
								isIOS : isIOS,
								isAndroid : isAndroid,
								isWindowsMobile : isWindowsMobile,
								participants : function() {
									var data = $.Deferred();
									if (roomUsers.length > 0) {
										data.resolve(roomUsers, roomId, roomTitle);
									} else {
										chatApplication.getUsers(roomId, function (chatUsers) {
											var unames = [];
											for (var i=0; i<chatUsers.length; i++) {
												var u = chatUsers[i];
												unames.push(u.name);
											}
											var get = getUsersInfo(unames);
											get.done(function(users) {
												data.resolve(users, roomId, roomTitle);												
											});
											get.fail(function(e, status) {
												if (typeof(status) == "number" && status == 404) {
													log(">> initChat < ERROR get_users " + (e.message ? e.message + " " : "Not found ") + " for " + currentUser.name + ": " + JSON.stringify(e));
												} else {
													log(">> initChat < ERROR get_users : " + JSON.stringify(e));
													// TODO notify the user?
												}
											});
					          });										
									}
									return data.promise();
								}
							};
							return context;
						};
						
						var initializer = addCallButton($wrapper, chatContext(roomName));
						initializer.done(function($container) {
							$container.find(".startCallButton").addClass("chatCall");
							$wrapper.show();
							log("<< initChat DONE " + roomName + " for " + currentUser.name);
						});
						initializer.fail(function(error) {
							log("<< initChat ERROR " + roomName + " for " + currentUser.name + ": " + error);
						});
					} else {
						log("Chat app team dropdown not found");
					}
				} else {
					log("Chat app room not found");
				}
				}, 5000);
			}
		};

		/**
		 * Add call button to user popups and panels.
		 */
		var initUserPopups = function(compId) {
			var $tiptip = $("#tiptip_content");
			// wait for UIUserProfilePopup script load
			if ($tiptip.length == 0 || $tiptip.hasClass("DisabledEvent")) {
				setTimeout($.proxy(initUserPopups, this), 250, compId);
				return;
			}
			
			var userContext = function(userName) {
				var context = {
					currentUser : currentUser,
					userName : userName,
					isIOS : isIOS,
					isAndroid : isAndroid,
					isWindowsMobile : isWindowsMobile,
					participants : function() {
						var data = $.Deferred();
						// access user via property defined below
						context.user.done(function(user) {
							// resolve with array of participants, id for DOM elements, title for UI
							data.resolve([ user ], user.name, user.title);
						});
						return data.promise();
					}
				};
				Object.defineProperty(context, "user", {
				  enumerable: true,
				  configurable: false,
				  get: function() {
				  	var get = getUserInfo(userName);
						get.fail(function(e, status) {
							if (typeof(status) == "number" && status == 404) {
								log(">> initUserPopups < ERROR get_user " + (e.message ? e.message + " " : "Not found ") + userName + " for " + currentUser.name + ": " + JSON.stringify(e));
							} else {
								log(">> initUserPopups < ERROR get_user : " + JSON.stringify(e));
								// TODO notify the user?
							}
						});
						return get;
				  },
				  set: function() {
				  	log(">> initUserPopups < ERROR set_user not supported " + userName + " for " + currentUser.name);
				  	throw "Changing 'user' property not supported";
				  }
				});
				return context;
			};

			var addUserButton = function($userAction, userName) {
				var initializer = addCallButton($userAction, userContext(userName));
				initializer.done(function($container) {
					$container.find(".startCallButton").addClass("userCall");
					log("<< initUserPopups DONE " + userName + " for " + currentUser.name);
				});
				initializer.fail(function(error) {
					log("<< initUserPopups ERROR " + userName + " for " + currentUser.name + ": " + error);
				});
				return initializer.promise();
			};

			var extractUserName = function($userLink) {
				var userName = $userLink.attr("href");
				return userName.substring(userName.lastIndexOf("/") + 1, userName.length);
			};

			// user popovers
			var customizePopover = function() {
				// wait for popover initialization
				setTimeout(function() {
					// Find user's first name for a tip
					var $td = $tiptip.children("#tipName").children("tbody").children("tr").children("td");
					if ($td.length > 1) {
						var $userLink = $("a", $td.get(1));
						var userName = extractUserName($userLink);
						if (userName != currentUser.name) {
							var $userAction = $tiptip.find(".uiAction");
							var buttonUser = $userAction.data("callbuttonuser");
							if (!buttonUser || buttonUser != userName) {
								$userAction.data("callbuttonuser", userName);
								// cleanup after previous user
								$userAction.find(".callButtonContainer").empty();
								addUserButton($userAction, userName).done(function($container) {
									// XXX workaround to avoid first-child happen on call button in the popover
									$container.prepend($("<div class='btn' style='display: none;'></div>"));
								});
							}
						}
					} else {
						log("WARN tipName empty " + $td);
					}
				}, 300);
			};
			// XXX wait for loading activity stream (TODO try rely on a promise)
			setTimeout(function() {
				// XXX hardcoded for peopleSuggest as no way found to add Lifecycle to its portlet (juzu)
				// user popovers in Social (authors, commenters, likers, profile, network, connections etc)
				$("#" + compId).find(".owner, .author, .spaceTitle, .activityAvatar, .commmentLeft, .listLiked, .profileContainer, .avatarBox, .userProfileShare .pull-left, #onlineList").find("a[href*='\\/profile\\/']").each(function() {
					var $a = $(this);
					//log("init social popup " + $a.attr("href"));
					$a.mouseenter(function() {
						customizePopover();
					});
				});				
				
				// user popovers in Forum
				$("#" + compId).find("#UIForumContainer .postViewHeader").find("div[href*='\\/profile\\/']").each(function() {
					var $div = $(this);
					//log("init forum popup " + $div.attr("href"));
					$div.mouseenter(function() {
						customizePopover();
					});
				});
			}, 1000);

			// user panel in connections (all, personal and in space)
			// May 22 2017: we don't want Call Button in user cards
			/*$("#" + compId).find(".spaceBox").each(function(i, elem) {
				var $userLink = $(elem).find(".spaceTitle a:first");
				if ($userLink.length > 0) {
					//var userTitle = $userLink.text();
					var userName = extractUserName($userLink);
					if (userName != currentUser.name) {
						var $userAction = $(elem).find(".connectionBtn");
						addUserButton($userAction, userName).done(function($container) {
							$container.addClass("pull-right");
						});
					}
				}
			});*/

			// single user profile;
			$("#" + compId).find("#socialTopLayout").each(function(i, elem) {
				var $userStatus = $(elem).find("#UIStatusProfilePortlet .user-status");
				//var userTitle = $userStatus.children("span").text();  
				var userName = $userStatus.data("userid");
				if (userName != currentUser.name) {
					var $userActions = $(elem).find("#UIRelationshipAction .user-actions");
					addUserButton($userActions, userName).done(function($container) {
						$container.addClass("pull-left");
					});
					// Copied from Chat app: Fix PLF-6493: Only let hover happens on
					// connection buttons instead
					// of all in .user-actions
					var $btnConnections = $userActions.find(".show-default, .hide-default");
					var $btnShowConnection = $userActions.find(".show-default");
					var $btnHideConnection = $userActions.find(".hide-default");
					$btnShowConnection.show();
					$btnConnections.css("font-style", "italic");
					$btnHideConnection.hide();
					$btnConnections.removeClass("show-default hide-default");
					$btnConnections.hover(function(e) {
					  $btnConnections.toggle();
					});
				}
			});
		};
		
		var initSpace = function() {
			if (currentUser && currentSpace) {
				var $navigationPortlet = $("#UIBreadCrumbsNavigationPortlet");
				if ($navigationPortlet.length == 0) {
					setTimeout($.proxy(initSpace, this), 250);
					return;
				}
				
				var spaceContext = function() {
					var context = {
						currentUser : currentUser,
						spaceName : currentSpace.spaceName,
						isIOS : isIOS,
						isAndroid : isAndroid,
						isWindowsMobile : isWindowsMobile,
						participants : function() {
							var data = $.Deferred();
							// access space via property defined below
							context.space.done(function(space) {
								// resolve with array of participants, id for DOM elements, title for UI
								data.resolve(space.members, space.prettyName, space.title);								
							});
							return data.promise();
						}
					};
					Object.defineProperty(context, "space", {
					  enumerable: true,
					  configurable: false,
					  get: function() {
					  	var get = getSpaceInfo(currentSpace.spaceName);
					  	get.fail(function(e, status) {
								if (typeof(status) == "number" && status == 404) {
									log(">> initSpace < ERROR get_space " + currentSpace.spaceName + " for " + currentUser.name + ": " + (e.message ? e.message + " " : "Not found ") + currentSpace.spaceName + ": " + JSON.stringify(e));
								} else {
									log(">> initSpace < ERROR get_space " + currentSpace.spaceName + " for " + currentUser.name + ": " + JSON.stringify(e));
								}
							});
							return get;
					  },
					  set: function() {
					  	log(">> initSpace < ERROR set_space not supported " + currentSpace.spaceName + " for " + currentUser.name);
					  	throw "Changing 'space' property not supported";
					  }
					});
					return context;
				};
				
				var $breadcumbEntry = $navigationPortlet.find(".breadcumbEntry");
				
				var initializer = addCallButton($breadcumbEntry, spaceContext());
				initializer.done(function($container) {
					var $button = $container.find(".startCallButton");
					$button.addClass("spaceCall");
					var $first = $button.first();
					var $dropdown = $first.siblings(".dropdown-toggle");
					var $hover = $();
					if ($first.hasClass("transparentButton")) {
						if ($dropdown.length == 1) {
							$hover = $hover.add($dropdown);							
						}
					} else {
						$first.addClass("transparentButton");
						$hover = $hover.add($first).add($dropdown);
					}
					$hover.hover(function() {
						$first.removeClass("transparentButton");
					}, function() {
						$first.addClass("transparentButton");
					});						
					log("<< initSpace DONE " + currentSpace.spaceName + " for " + currentUser.name);
				});
				initializer.fail(function(error) {
					log("<< initSpace ERROR " + currentSpace.spaceName + " for " + currentUser.name + ": " + error);
				});
			}
		};
		
		this.update = function(compId) {
			if (!compId) {
				// by default we work with whole portal page
				compId = "UIPortalApplication";
			}
			if (currentUser) { 
				initUserPopups(compId);
				initSpace();
				initChat();
			}
		};

		/**
		 * Initialize context
		 */
		this.init = function(user, context) {
			if (user) {
				currentUser = user;
				prepareUser(currentUser);
				log("User initialized in Video Calls: " + user.name + ".");
				if (context.spaceName) {
					// TODO what about chat rooms?
					currentSpace = context;
				} else {
					currentSpace = null;
				}
				// also init registered providers
				for (var i = 0; i < providers.length; i++) {
					var p = providers[i];
					if (!p.isInitialized && p.init && p.hasOwnProperty("init")) {
						p.init();
						p.isInitialized = true;
					}
				}
			}
		};
		
		this.getUser = function() {
			return currentUser;
		};
		
		this.getBaseUrl = function() {
			return pageBaseUrl();
		};
		
		/**
		 * Add provider to the scope.
		 */
		this.addProvider = function(provider) {
			// A Provider should support set of API methods:
			// * getType() - major call type name
			// * getSupportedTypes() - all supported call types
			// * getTitle() - human-readable title for UI
			// * callButton(context) - provider should offer an implementation of a Call button and call invoker in it, 
			// it returns a promise, when it resolved there will be a JQuery element of a button(s) container. 
			//
			// A provider may support following of API methods:
			// * update(stateObj) - when Video Calls will need update the state and UI, it will call the method
			// * init() - will be called when Video Calls user will be initialized in init()
			//
			
			// TODO avoid duplicates, use map like?
			if (provider.getSupportedTypes && provider.hasOwnProperty("getSupportedTypes") && provider.getTitle && provider.hasOwnProperty("getTitle")) {
				if (provider.callButton && provider.hasOwnProperty("callButton")) {
					providers.push(provider);
					// care about providers added after Video Calls initialization
					if (currentUser && !provider.isInitialized && provider.init && provider.hasOwnProperty("init")) {
						provider.init();
						provider.isInitialized = true;
					};
				} else {
					log("Not compartible provider object: " + provider.getName());
				}
			} else {
				log("Not a provider object: " + JSON.stringify(provider));
			}
		};
		
		/**
		 * Return registered provider by its type name.
		 */
		this.getProvider = function(type) {
			// TODO use more fast way with object-map?
			for (var i = 0; i < providers.length; i++) {
				var p = providers[i];
				var ptypes = p.getSupportedTypes();
				for (var ti = 0; ti < ptypes.length; ti++) {
					if (ptypes[ti] === type) {
						return p;
					}					
				}
			}
		};
		
		/**
		 * Add style to current document (to the end of head).
		 */
		this.loadStyle = function(cssUrl) {
			if (document.createStyleSheet) {
				document.createStyleSheet(cssUrl); // IE way
			} else {
				if ($("head").find("link[href='"+cssUrl+"']").length == 0) {
					var headElems = document.getElementsByTagName("head");
					var style = document.createElement("link");
					style.type = "text/css";
					style.rel = "stylesheet";
					style.href = cssUrl;
					headElems[headElems.length - 1].appendChild(style);
					// $("head").append($("<link href='" + cssUrl + "' rel='stylesheet' type='text/css' />"));
				} // else, already added
			}
		};
		
		/**
		 * Helper method to show call popup according the Web Conferencing spec.
		 */
		this.showCallPopup = function(url, title) {
			// FYI Core adopted from Video Calls v1 notif.js
			var aw = window.screen.availWidth; // screen.width
			var ah = window.screen.availHeight; // screen.height
		  var w = Math.floor(aw * 0.8);
		  var h = Math.floor(ah * 0.8);
		  var left = (aw/2)-(w/2);
		  var top = (ah/2)-(h/2);
		  var callWindow = window.open(url, title, "toolbar=no,menubar=no,scrollbars=no,resizable=no,location=no,directories=no,status=no,"
		  			+ "width=" + w + ",height=" + h + ",top=" + top + ",left=" + left);
		  callWindow.focus();
		  return callWindow;
		};
		
		/** 
		 * Helper method to obtain the user IM account of given type.
		 */
		this.imAccount = function(user, type) {
			var ims = user.imAccounts[type];
			if (ims && ims.length > 0) {
				// TODO work with multiple IMs of same type
				return ims[0]; 
			} else {
				return null;
			}
		};
		
		this.showWarn = function(title, text, onInit) {
			showWarn(title, text, onInit);
		};
		
		this.showWarnBar = function(title, text, onInit) {
			showWarnBar(title, text, onInit);
		};
	}
	
	var videoCalls = new VideoCalls();
	
	// Register videoCalls in global eXo namespace (for non AMD uses)
	if (typeof window.eXo === "undefined" || !eXo) {
		window.eXo = {};
	}
	if (typeof eXo.videoCalls === "undefined" || !eXo.videoCalls) {
		eXo.videoCalls = videoCalls;
	} else {
		log("eXo.videoCalls already defined");
	}
	
	$(function() {
		// Init notification styles
		try {
			// configure Pnotify: use jQuery UI css
			$.pnotify.defaults.styling = "jqueryui";
			// no history roller in the right corner
			$.pnotify.defaults.history = false;
			
			// XXX workaround to load CSS until gatein-resources.xml's portlet-skin will work as expected
			// for Dynamic Containers
			videoCalls.loadStyle("/videocalls/skin/jquery-ui.min.css");
			videoCalls.loadStyle("/videocalls/skin/jquery-ui.structure.min.css");
			videoCalls.loadStyle("/videocalls/skin/jquery-ui.theme.min.css");
			videoCalls.loadStyle("/videocalls/skin/jquery.pnotify.default.css");
			videoCalls.loadStyle("/videocalls/skin/jquery.pnotify.default.icons.css");
			//videoCalls.loadStyle("/videocalls/skin/videocalls.css");
			// FYI eXo.env.client.skin contains skin name, it can be consulted to load a specific CSS
		} catch(e) {
			log("Error configuring Video Calls notifications.", e);
		}
	});

	return videoCalls;
})($);
