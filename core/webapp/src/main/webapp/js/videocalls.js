/**
 * Skype calls integration for eXo Platform.
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
	
	var prepareUser = function(user, isSkypeBusiness) {
		user.title = user.firstName + " " + user.lastName;
	};
	
	/**
	 * VideoCalls core class.
	 */
	function VideoCalls() {

		// ******** Context ********
		var currentUser, currentSpace;
		
		var spaceUpdater;
		// TODO move to Skype provider script
		var config, skype;
		// Registered providers
		var providers = [];

		/**
		 * TODO a placeholder for Chat initialization
		 */
		var initChat = function() {
			if (chatApplication) {
				log("Init chat for " + chatApplication.username);

				var $chat = $("#chat-application");
				if ($chat.size() > 0) {
					var $room = $chat.find("a.room-detail-fullname");
					if ($room.size() == 0) {
						// TODO
					}
				}
			}
		};

		var initUserPopups = function(compId) {
			var $tiptip = $("#tiptip_content");
			// if not in user profile wait for UIUserProfilePopup script load
			if (window.location.href.indexOf("/portal/intranet/profile") < 0) {
				if ($tiptip.size() == 0 || $tiptip.hasClass("DisabledEvent")) {
					setTimeout($.proxy(initUserPopups, this), 250, compId);
					return;
				}
			}

			function addButton($userAction, userName, userTitle, tuningFunc) {
				if ($userAction.size() > 0 && !$userAction.data("skypebutton")) {
					$userAction.data("skypebutton", true);
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
							if (user.imAccounts["ms-sfb"]) {
								userIM = user.imAccounts["ms-sfb"].id;
								isBusiness = true;
							} else {
								userIM = user.imAccounts.skype.id;
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
								var currentIsBusiness = currentUser.imAccounts["ms-sfb"];
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

			function extractUserName($userLink) {
				var userName = $userLink.attr("href");
				return userName.substring(userName.lastIndexOf("/") + 1, userName.length);
			}

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
						if ($td.size() > 1) {
							var $userLink = $("a", $td.get(1));
							var userTitle = $userLink.text();
							var userName = extractUserName($userLink);
							var $userAction = $tiptip.find(".uiAction");
							addButton($userAction, userName, userTitle, function($button) {
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
				if ($userLink.size() > 0) {
					var userTitle = $userLink.text();
					var userName = extractUserName($userLink);
					var $userAction = $(elem).find(".connectionBtn");
					addButton($userAction, userName, userTitle, function($button) {
						$button.css({ "float" : "right", "height" : "28px"});
						$button.find("p").css("margin", "0px");
						$button.find("img").css({ "margin" : "5px 0 0 0", "vertical-align" : "0px"});						
					});
				}
			});

			// single user profile; TODO it doesn't work in PLF 4.4.1
			$("#" + compId).find("#socialTopLayout").each(function(i, elem) {
				var $userStatus = $(elem).find("#UIStatusProfilePortlet .user-status");
				var userTitle = $userStatus.children("span").text();  
				var userName = $userStatus.data("userid");
				var $userActions = $(elem).find("#UIRelationshipAction .user-actions");
				addButton($userActions, userName, userTitle, function($button) {
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
		var initSpace = function(compId) {
			if (currentUser && currentSpace) {
				var $navigationPortlet = $("#UIBreadCrumbsNavigationPortlet");
				if ($navigationPortlet.size() == 0) {
					setTimeout($.proxy(initSpace, this), 250, compId);
					return;
				}
				
				var currentIsSkype = currentUser.imAccounts.skype;
				var currentIsBusiness = currentUser.imAccounts["ms-sfb"];
				if (currentIsSkype || currentIsBusiness) {
					var $breadcumbEntry = $navigationPortlet.find(".breadcumbEntry");
					if ($breadcumbEntry.size() > 0 && !$breadcumbEntry.data("skypebutton")) {
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
								  	var isBusiness = u.imAccounts["ms-sfb"];
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
		
		/**
		 * TODO
		 * 
		 * @Deprecated
		 */
		var initSpaceWeb_Skype = function(compId) {
			if (currentUser && currentSpace) {
				var $navigationPortlet = $("#UIBreadCrumbsNavigationPortlet");
				if ($navigationPortlet.size() == 0) {
					setTimeout($.proxy(initSpace, this), 250, compId);
					return;
				}
				
				var currentIsSkype = currentUser.imAccounts.skype;
				var currentIsBusiness = currentUser.imAccounts["mssfb"];
				if (currentIsBusiness) {
					var $breadcumbEntry = $navigationPortlet.find(".breadcumbEntry");
					// TODO callbuttoninit data used to avoid multithread calls (by DOM observer listeners)
					if ($breadcumbEntry.size() > 0 && !$breadcumbEntry.data("callbuttoninit")) {
						log(">>> initSpaceWeb " + compId + " " + currentUser.name);
						var initializer = $.Deferred();
						$breadcumbEntry.data("callbuttoninit", true);
						if (spaceUpdater) {
							spaceUpdater.clearInterval();
						}
						var $container = $breadcumbEntry.find(".callButtonContainer");
						// TODO check precisely that we have an one button for each provider
						if (providers.length > 0) {
							if ($container.find(".startCallButton").size() != providers.length) {
								var get = getSpaceInfo(currentSpace.spaceName);
								// TODO do we really need call REST, may be it could be injected in env?
								get.done(function(space) {
									if ($container.size() == 0) {
										$container = $("<div style='display: none;' class='btn-group callButtonContainer'></div>");
										$breadcumbEntry.append($container);
									}
									var actionClasses = "actionIcon startCallButton spaceCall";
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
											if ($dropdown.size() > 0) {
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
									if ($dropdown.children().size() > 0) {
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
						log("<<< initSpaceWeb SKIP " + compId + " " + currentUser.name);
					}
				}
			}
		};
		
		var initSpaceWeb = function(compId) {
			if (currentUser && currentSpace) {
				var $navigationPortlet = $("#UIBreadCrumbsNavigationPortlet");
				if ($navigationPortlet.size() == 0) {
					setTimeout($.proxy(initSpace, this), 250, compId);
					return;
				}
				
				var $breadcumbEntry = $navigationPortlet.find(".breadcumbEntry");
				// TODO callbuttoninit data used to avoid multithread calls (by DOM observer listeners)
				if ($breadcumbEntry.size() > 0 && !$breadcumbEntry.data("callbuttoninit")) {
					log(">>> initSpaceWeb " + compId + " " + currentUser.name);
					var initializer = $.Deferred();
					$breadcumbEntry.data("callbuttoninit", true);
					if (spaceUpdater) {
						spaceUpdater.clearInterval();
					}
					// TODO check precisely that we have an one button for each provider
					if (providers.length > 0) {
						var $container = $breadcumbEntry.find(".callButtonContainer");
						if ($container.find(".startCallButton").size() != providers.length) {
							var get = getSpaceInfo(currentSpace.spaceName);
							// TODO do we really need call REST, may be it could be injected in env?
							get.done(function(space) {
								if ($container.size() == 0) {
									$container = $("<div style='display: none;' class='btn-group callButtonContainer'></div>");
									$breadcumbEntry.append($container);
								}
								var actionClasses = "actionIcon startCallButton spaceCall";
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
										if ($dropdown.size() > 0) {
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
								if ($dropdown.children().size() > 0) {
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
					log("<<< initSpaceWeb SKIP " + compId + " " + currentUser.name);
				}
			}
		};
		
		this.update = function(compId) {
			if (!compId) {
				// by default we work with whole portal page
				compId = "UIPortalApplication";
			}
			if (currentUser) { 
				// initUserPopups(compId);
				initSpaceWeb(compId);
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
			// * getName() - internal ID and schema/prefix in profile's IM accounts
			// * getTitle() - human-readable title for UI
			// * callButton(context) - provider should offer an implementation of a Call button and call invoker in it
			//
			// A provider may support following of API methods:
			// * update(stateObj) - when Video Calls will need update the state and UI, it will call the method
			//
			// WARN Provider may be added before the app initialization with user context and settings.
			
			// TODO avoid duplicates, use map like?
			if (provider.getName && provider.hasOwnProperty("getName") && provider.getTitle && provider.hasOwnProperty("getTitle")) {
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
		 * Return registered provider by its name.
		 */
		this.getProvider = function(name) {
			// TODO use more fast way with object-map?
			for (var i = 0; i < providers.length; i++) {
				var p = providers[i];
				if (p.name === name) {
					return p;
				}
			}
		};
	}
	
	// /////

	var videoCalls = new VideoCalls();
	
	// Register videoCalls in global eXo namespace (for non AMD uses)
	if (typeof eXo === "undefined" || !eXo) {
		eXo = {};
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
		} catch(e) {
			log("Error configuring Video Calls notifications.", e);
		}
	});

	return videoCalls;
})($); // , videoCallsJqueryUI, videoCallsJqueryPnotify
