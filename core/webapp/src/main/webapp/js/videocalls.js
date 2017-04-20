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
			closer : options && typeof options.closer != "undefined" ? options.closer : true,
			sticker : false,
			opacity : .75,
			shadow : true,
			width : options && options.width ? options.width : NOTICE_WIDTH,
			nonblock : options && typeof options.nonblock != "undefined" ? options.nonblock : false,
			nonblock_opacity : .25,
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
			hide : false,
			delay : 30000,
			icon : "picon-dialog-warning",
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

	var getUserInfo = function(userName) {
		var request = $.ajax({
			async : true,
			type : "GET",
			url : prefixUrl + "/portal/rest/videocalls/user/" + userName
		});

		return initRequest(request);
	};
	
	var getSpaceInfo = function(spaceName) {
		var request = $.ajax({
			async : true,
			type : "GET",
			url : prefixUrl + "/portal/rest/videocalls/space/" + spaceName
		});

		return initRequest(request);
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
			if ($target.length > 0 && !$target.data("callbuttoninit")) {
				$target.data("callbuttoninit", true);
				if (providers.length > 0) {
					var $container = $target.find(".callButtonContainer");
					// TODO check precisely that we have an one button for each provider
					if ($container.find(".startCallButton").length != providers.length) {
						var contextName = (context.spaceName ? context.spaceName : context.userName);
						initializer.notify("addCallButton " + contextName + " for " + context.currentUser.name);
						if ($container.length == 0) {
							$container = $("<div style='display: none;' class='btn-group callButtonContainer'></div>");
							$target.append($container);
						}
						var actionClasses = "startCallButton"; // actionIcon
						var $dropdown = $container.find(".dropdown-menu");
						var buttons = [];
						for (var i = 0; i < providers.length; i++) {
							var p = providers[i];
							var button = p.callButton(context);
							button.done(function($button) {
								if ($dropdown.length > 0) {
									// add others in dropdown
									$button.addClass(actionClasses);
									$dropdown.append($button);	
								} else {
									// add first & default button
									$button.addClass("btn " + actionClasses); // btn-primary
									$container.append($button); 
									$dropdown = $("<ul class='dropdown-menu'></ul>");
								}
							});
							buttons.push(button);
						}
						$.when.apply($, buttons).always(function() {
							if ($dropdown.children().length > 0) {
								// btn-primary
								$container.append($("<a class='btn dropdown-toggle' data-toggle='dropdown' href='#'><span class='caret'></span></a>"));
								$container.append($dropdown);
							}
							if (buttons.length > 0) {
								$container.show();
								initializer.resolve($container);
							} else {
								initializer.reject("Nothing added");
							}
		        });
					}	else {
						initializer.reject("Already initialized", $container);
					}
				} else {
					initializer.reject("No providers");
				}
				initializer.always(function() {
					$target.data("callbuttoninit", false);
				});
			} else {
				initializer.reject("Target not found or already initializing");
			}
			return initializer.promise();
		};
		
		var userContext = function(userName) {
			var context = {
				currentUser : currentUser,
				userName : userName,
				isIOS : isIOS,
				isAndroid : isAndroid,
				isWindowsMobile : isWindowsMobile,
				_user : null
			};
			Object.defineProperty(context, "user", {
			  enumerable: true,
			  configurable: false,
			  get: function() {
			  	// We use short-living cache for 5s
			  	var cached = context._user;
			  	if (cached) {
			  		log(">> initUserPopups > get_user CACHED " + userName + " for " + currentUser.name);
			  		var get = $.Deferred();
			  		get.resolve(cached);
			  		return get.promise();
			  	} else {
			  		log(">> initUserPopups > get_user " + userName + " for " + currentUser.name);
			  		var get = getUserInfo(userName);
				  	get.done(function(user) {
				  		context._user = user;
				  		setTimeout(function() {
				  			context._user = null;
				  		}, 5000);
				  	});
						get.fail(function(e, status) {
							if (status == 404) {
								log(">> initUserPopups < ERROR get_user " + (e.message ? e.message + " " : "Not found ") + userName + " for " + currentUser.name + ": " + JSON.stringify(e));
							} else {
								log(">> initUserPopups < ERROR get_user : " + JSON.stringify(e));
								// TODO notify the user?
							}
						});
						return get;
			  	}
			  },
			  set: function() {
			  	log(">> initUserPopups < ERROR set_user not supported " + userName + " for " + currentUser.name);
			  	throw "Changing 'user' property not supported";
			  }
			});
			return context;
		};
		
		/**
		 * TODO a placeholder for Chat initialization
		 */
		var initChat = function() {
			if (chatApplication) {
				log("Init chat for " + chatApplication.username);

				var $chat = $("#chat-application");
				if ($chat.length > 0) {
					var $room = $chat.find("a.room-detail-fullname");
					if ($room.length == 0) {
						// TODO
					}
				}
			}
		};

		/**
		 * Add call button to user popups and panels. TODO Adapt to provider model.
		 */
		var initUserPopups = function(compId) {
			var $tiptip = $("#tiptip_content");
			// if not in user profile wait for UIUserProfilePopup script load
			if (window.location.href.indexOf("/portal/intranet/profile") < 0) {
				if ($tiptip.length == 0 || $tiptip.hasClass("DisabledEvent")) {
					setTimeout($.proxy(initUserPopups, this), 250, compId);
					return;
				}
			}

			/** @Deprecated */
			function addButton($userAction, userName, userTitle, tuningFunc) {
				if ($userAction.length > 0 && !$userAction.data("callbuttoninit")) {
					$userAction.data("callbuttoninit", true);
					
					var callId = "Call " + currentUser.title + " with " + userTitle;
					// TODO check if call not already started (by another user)
					var get = getUserInfo(userName);
					get.done(function(user) {
						if (isSkypeUser(user)) {
							prepareUser(user); 
							var linkId = "SkypeButton-" + userName.split(".").join("") + Math.floor((Math.random() * 1000000) + 1);
							var $button = $("<div id='" + linkId + "' style='display: none;'></div>");
							$userAction.append($button);
							var userIM, isBusiness;
							if (user.imAccounts.mssfb) {
								userIM = user.imAccounts.mssfb[0].id;
								isBusiness = true;
							} else {
								userIM = user.imAccounts.skype[0].id;
								isBusiness = false;
							}
							var res = Skype.ui({
								name: "call",
								topic: callId,
								element: linkId,
								participants: [userIM], // currentUser.skypeIM
								imageSize: 24,
								imageColor: "skype",
								useDetection: "false"
							});
							if (res) {
								var currentIsBusiness = currentUser.imAccounts.mssfb;
								if (currentIsBusiness && isBusiness && (isIOS || isAndroid)) { 
									// current user is business - use SfB URI
									// TODO is it for mobile only?
									var $link = $button.find("a");
									$link.attr("href", "ms-sfb://call?id=" + encodeURIComponent(userIM) + "&video=true");
								} // otherwise - use normal Skype, it was just
									// generated above
								$button.addClass("startCallAction");
								$button.show();
								$button.data("callid", callId);
								if (tuningFunc) {
									tuningFunc($button);
								}
								log("Created Skype call button for " + userTitle + ". " + $button);
							} else {
								$userAction.data("skypebutton", false);
								log("Cannot create Skype call button for " + userTitle + ". " + $button);
							}
						} else {
							log("Skype IM not found for " + userTitle + ". Call button cannot be created.");
						}
					});
					get.fail(function(e, status) {
						$userAction.data("skypebutton", false);
						if (status == 404) {
							log("ERROR " + (e.message ? e.message + " " : "Not found ") + userTitle + ": " + JSON.stringify(e));
						} else {
							log("ERROR reading user: " + JSON.stringify(e));
							// showWarn("Error reading Skype IM of " +
							// userTitle, e.message);
						}
					});
				}
			}
			
			var addUserButton = function($userAction, userName) {
				var initializer = addCallButton($userAction, userContext(userName));
				initializer.progress(function(message) {
					log(">> initUserPopups PROGRESS " + message);
				});
				initializer.done(function($container) {
					$container.find(".startCallButton").addClass("userCall");
					log("<< initUserPopups DONE " + userName + " for " + currentUser.name);
				});
				initializer.fail(function(error, $container) {
					log("Error creating call button for " + userName + ": " + error);
					if ($container) {
						log("<< initUserPopups SKIPPED (" + error + ") " + userName + " for " + currentUser.name);
					} else {
						log("<< initUserPopups ERROR " + userName + " for " + currentUser.name + ": " + error);
					}
				});
				return initializer;
			};

			var extractUserName = function($userLink) {
				var userName = $userLink.attr("href");
				return userName.substring(userName.lastIndexOf("/") + 1, userName.length);
			};

			// user popovers
			// XXX hardcoded for peopleSuggest as no way found to add Lifecycle
			// to its portlet (juzu)
			$("#" + compId + ", #peopleSuggest").find(".owner, .author").find("a:[href*='/profile/']").each(function() {
				// attach action to
				$(this).mouseenter(function() {
					// need wait for popover initialization
					setTimeout(function() {
						// Find user's first name for a tip
						var $td = $tiptip.children("#tipName").children("tbody").children("tr").children("td");
						if ($td.length > 1) {
							var $userLink = $("a", $td.get(1));
							//var userTitle = $userLink.text();
							var userName = extractUserName($userLink);
							var $userAction = $tiptip.find(".uiAction");
							addUserButton($userAction, userName).done(function($container) {
								var $button = $container.find(".startCallAction");
								$button.find("p").css("margin", "0px");
								$button.find("img").css("margin", "20px");
							});
						}
					}, 600);
				});
			});

			// user panel in connections (all, personal and in space)
			$("#" + compId).find(".spaceBox").each(function(i, elem) {
				var $userLink = $(elem).find(".spaceTitle a:first");
				if ($userLink.length > 0) {
					//var userTitle = $userLink.text();
					var userName = extractUserName($userLink);
					var $userAction = $(elem).find(".connectionBtn");
					addUserButton($userAction, userName).done(function($container) {
						var $button = $container.find(".startCallAction");
						$button.css({ "float" : "right", "height" : "28px"});
						$button.find("p").css("margin", "0px");
						$button.find("img").css({ "margin" : "5px 0 0 0", "vertical-align" : "0px"});						
					});
				}
			});

			// single user profile; TODO it doesn't work in PLF 4.4.1
			$("#" + compId).find("#socialTopLayout").each(function(i, elem) {
				var $userStatus = $(elem).find("#UIStatusProfilePortlet .user-status");
				//var userTitle = $userStatus.children("span").text();  
				var userName = $userStatus.data("userid");
				var $userActions = $(elem).find("#UIRelationshipAction .user-actions");
				addUserButton($userActions, userName).done(function($container) {
					var $button = $container.find(".startCallAction");
					$button.css({ "float" : "left", "height" : "28px"});
					$button.find("img").css({ "margin" : "5px 5px 0 0", "vertical-align" : "0px"});					
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
			});
		};

		/**
		 * TODO
		 * 
		 * @Deprecated
		 */
		var initSpace_old = function(compId) {
			if (currentUser && currentSpace) {
				var $navigationPortlet = $("#UIBreadCrumbsNavigationPortlet");
				if ($navigationPortlet.length == 0) {
					setTimeout($.proxy(initSpace, this), 250, compId);
					return;
				}
				
				var currentIsSkype = currentUser.imAccounts.skype;
				var currentIsBusiness = currentUser.imAccounts.mssfb;
				if (currentIsSkype || currentIsBusiness) {
					var $breadcumbEntry = $navigationPortlet.find(".breadcumbEntry");
					if ($breadcumbEntry.length > 0 && !$breadcumbEntry.data("skypebutton")) {
						$breadcumbEntry.data("skypebutton", true);
						if (spaceUpdater) {
							spaceUpdater.clearInterval();
						}
						var get = getSpaceInfo(currentSpace.spaceName);
						get.done(function(space) {
							// had classes uiIconWeemoVideoCalls
							// uiIconWeemoLightGray
							var linkId = "SkypeButton-" + currentSpace.spaceName + Math.floor((Math.random() * 1000000) + 1);
							var $button = $("<div id='" + linkId + "' style='display: none;' class='startCallButton'><a class='actionIcon startCallAction spaceCall' title='Call of " 
									+ currentSpace.spaceName + "' style='margin-left:5px;'>" // target='_blank'
									+ "<img src='http://www.skypeassets.com/i/scom/images/skype-buttons/callbutton_24px.png' alt='Skype call' role='Button' style='border: 0px; margin: 2px;'>" 
									+ "</a></div>");
							// <i class='uiIconVideoCallSkype'></i>Call
							$breadcumbEntry.append($button);
							
							// build an URI
							// skype:participant1[;participant2;...participant9]?call&amp;video=true
							var participants = [];
							var useBusiness = currentIsBusiness && (isIOS || isAndroid);
							/*
							 * if (currentIsBusiness) { participants.push(currentIsBusiness.id); } else if (currentIsSkype) {
							 * participants.push(currentIsSkype.id); }
							 */
							for (var uname in space.members) {
								if (uname != currentUser.name) {
								  if (space.members.hasOwnProperty(uname)) {
								  	var u = space.members[uname];
								  	var isSkype = u.imAccounts.skype;
								  	var isBusiness = u.imAccounts.mssfb;
								  	if (isBusiness) {
								  		participants.push(encodeURIComponent(isBusiness.id));
								  	} else if (isSkype) {
								  		participants.push(isSkype.id);
								  	} // else, skip this user
								  }
								}
							}
							if (participants.length > 0) {
								var userIMs = participants.join(";");
								var $link = $button.find("a.startCallAction");
								if (useBusiness) {
									$link.attr("href", "ms-sfb://call?id=" + userIMs + "&video=true");
								} else if (currentIsSkype) {
									$link.attr("href", "skype:" + userIMs + "?call&amp;video=true&amp;topic=" + encodeURIComponent(currentSpace.roomName));
								}
								$link.click(function(e) {
									// call click handler
									// e.preventDefault();
									var callName = "Call of " + currentSpace.spaceName;
									var call = calls[currentSpace.roomName];
									// TODO
								});
								$button.show();
							}
						});
						get.fail(function(e, status) {
							$breadcumbEntry.data("skypebutton", false);
							if (status == 404) {
								log("ERROR " + (e.message ? e.message + " " : "Not found ") + currentSpace.spaceName + ": " + JSON.stringify(e));
							} else {
								log("ERROR reading space users: " + JSON.stringify(e));
							}
						});
					}
				}
			}
		};
		
		var initSpaceWeb = function(compId) {
			if (currentUser && currentSpace) {
				var $navigationPortlet = $("#UIBreadCrumbsNavigationPortlet");
				if ($navigationPortlet.length == 0) {
					setTimeout($.proxy(initSpace, this), 250, compId);
					return;
				}
				
				var $breadcumbEntry = $navigationPortlet.find(".breadcumbEntry");
				// XXX callbuttoninit data used to avoid multithread calls (by DOM observer listeners)
				if ($breadcumbEntry.length > 0 && !$breadcumbEntry.data("callbuttoninit")) {
					log(">>> initSpaceWeb " + compId + " " + currentUser.name);
					var initializer = $.Deferred();
					$breadcumbEntry.data("callbuttoninit", true);
					// TODO check precisely that we have an one button for each provider
					if (providers.length > 0) {
						var $container = $breadcumbEntry.find(".callButtonContainer");
						if ($container.find(".startCallButton").length != providers.length) {
							var get = getSpaceInfo(currentSpace.spaceName);
							// TODO do we really need call REST, may be it could be injected in env?
							get.done(function(space) {
								if ($container.length == 0) {
									$container = $("<div style='display: none;' class='btn-group callButtonContainer'></div>");
									$breadcumbEntry.append($container);
								}
								var actionClasses = "startCallButton spaceCall"; // actionIcon 
								var context = {
									currentUser : currentUser,
									space : space,
									isIOS : isIOS,
									isAndroid : isAndroid
								};
								var $dropdown = $container.find(".dropdown-menu");
								var $button;
								for (var i = 0; i < providers.length; i++) {
									var p = providers[i];
									var $button = p.callButton(context);
									if ($button) {
										if ($dropdown.length > 0) {
											// add others in dropdown
											$button.addClass(actionClasses);
											$dropdown.append($button);	
										} else {
											// add first & default button
											$button.addClass("btn " + actionClasses); // btn-primary
											$container.append($button); 
											$dropdown = $("<ul class='dropdown-menu'></ul>");
										}
									}
								}
								if ($dropdown.children().length > 0) {
									// btn-primary
									$container.append($("<a class='btn dropdown-toggle' data-toggle='dropdown' href='#'><span class='caret'></span></a>"));
									$container.append($dropdown);
								}
								if ($button) {
									$container.show();
								}
								initializer.resolve();
								log("<<< initSpaceWeb DONE " + compId + " " + currentUser.name);
							});
							get.fail(function(e, status) {
								initializer.reject();
								if (status == 404) {
									log("<<< initSpaceWeb ERROR " + compId + " " + currentUser.name + ": " + (e.message ? e.message + " " : "Not found ") + currentSpace.spaceName + ": " + JSON.stringify(e));
								} else {
									log("<<< initSpaceWeb ERROR " + compId + " " + currentUser.name + ": reading space users: " + JSON.stringify(e));
								}
							});
						}	else {
							initializer.reject();
							log("<<< initSpaceWeb SKIPPED (already initialized) " + compId + " " + currentUser.name);
						}
					} else {
						initializer.reject();
						log("<<< initSpaceWeb CANCEL (no providers) " + compId + " " + currentUser.name);
					}
					initializer.always(function() {
						$breadcumbEntry.data("callbuttoninit", false);
					});
				} else {
					log("<<< initSpaceWeb SKIPPED (no breadcumbEntry or already initialized) " + compId + " " + currentUser.name);
				}
			}
		};
		
		var initSpace = function(compId) {
			if (currentUser && currentSpace) {
				var $navigationPortlet = $("#" + compId + " #UIBreadCrumbsNavigationPortlet");
				if ($navigationPortlet.length == 0) {
					setTimeout($.proxy(initSpace, this), 250, compId);
					return;
				}
				
				var spaceContext = function() {
					var context = {
						currentUser : currentUser,
						spaceName : currentSpace.spaceName,
						isIOS : isIOS,
						isAndroid : isAndroid,
						isWindowsMobile : isWindowsMobile,
						_space : null
					};
					Object.defineProperty(context, "space", {
					  enumerable: true,
					  configurable: false,
					  get: function() {
					  	// We use short-living cache for 5s
					  	var cached = context._space;
					  	if (cached) {
					  		log(">> initSpace > get_space CACHED " + currentSpace.spaceName);
					  		var get = $.Deferred();
					  		get.resolve(cached);
					  		return get.promise();
					  	} else {
						  	log(">> initSpace > get_space " + currentSpace.spaceName);
						  	var get = getSpaceInfo(currentSpace.spaceName);
						  	get.done(function(space) {
						  		context._space = space;
						  		setTimeout(function() {
						  			context._space = null;
						  		}, 5000);
						  	});
								get.fail(function(e, status) {
									if (status == 404) {
										log(">> initSpace < ERROR get_space " + currentSpace.spaceName + " for " + currentUser.name + ": " + (e.message ? e.message + " " : "Not found ") + currentSpace.spaceName + ": " + JSON.stringify(e));
									} else {
										log(">> initSpace < ERROR get_space " + currentSpace.spaceName + " for " + currentUser.name + ": " + JSON.stringify(e));
									}
								});
								return get;
					  	}
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
				initializer.progress(function(message) {
					log(">> initSpace PROGRESS " + message);
				});
				initializer.done(function($container) {
					$container.find(".startCallButton").addClass("spaceCall");
					log("<< initSpace DONE " + currentSpace.spaceName + " for " + currentUser.name);
				});
				initializer.fail(function(error, $container) {
					if ($container) {
						log("<< initSpace SKIPPED (" + error + ") in " + currentSpace.spaceName + " for " + currentUser.name);
					} else {
						log("<< initSpace ERROR " + currentSpace.spaceName + " for " + currentUser.name + ": " + error);
					}
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
				initSpace(compId);
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
			// * callButton(context) - provider should offer an implementation of a Call button and call invoker in it
			//
			// A provider may support following of API methods:
			// * update(stateObj) - when Video Calls will need update the state and UI, it will call the method
			//
			// WARN Provider may be added before the app initialization with user context and settings.
			
			// TODO avoid duplicates, use map like?
			if (provider.getSupportedTypes && provider.hasOwnProperty("getSupportedTypes") && provider.getTitle && provider.hasOwnProperty("getTitle")) {
				if (provider.update && provider.hasOwnProperty("update")) {
					provider.useUpdate = true;
				}
				if (provider.callButton && provider.hasOwnProperty("callButton")) {
					providers.push(provider);
					// this.update(); // XXX don't update explicitly, let the caller care about this
				} else {
					log("Not compartible provider object: " + provider.getName());
				}
			} else {
				log("Not a provider object: " + provider);
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
			videoCalls.loadStyle("/videocalls/skin/videocalls.css");
		} catch(e) {
			log("Error configuring Video Calls notifications.", e);
		}
	});

	return videoCalls;
})($);
