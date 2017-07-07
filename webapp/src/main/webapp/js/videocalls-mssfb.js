/**
 * Skype for Bunsiness provider module for Video Calls. This script will be used to add a provider to Video Calls module and then
 * handle calls for portal user/groups.
 */
(function($, videoCalls) {
	"use strict";
	
	/** For debug logging. */
	var objId = Math.floor((Math.random() * 1000) + 1);
	var logPrefix = "[mssfb_" + objId + "] ";
	var log = function(msg, e) {
		if (typeof console != "undefined" && typeof console.log != "undefined") {
			console.log(logPrefix + msg);
			if (e && typeof e.stack != "undefined") {
				console.log(e.stack);
			}
		}
	};
	log("> Loading at " + location.origin + location.pathname);
	
	/** 
	 * Polyfill ECMAScript 2015's String.startsWith().
	 * */
	if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
	  };
	}
	
	var globalVideoCalls = typeof eXo != "undefined" && eXo && eXo.videoCalls ? eXo.videoCalls : null;
	
	// Use videoCalls from global eXo namespace (for non AMD uses)
	if (!videoCalls && globalVideoCalls) {
		videoCalls = globalVideoCalls;
	}

	if (videoCalls) {
				
		function CallContainer($container) {
			var onMssfbCallShow = [];
			var onMssfbCallHide = [];
			
			var conversation = null;
			var callerId = null;
			var attached = true;
			
			var self = this;
			self.$container = $container;
			self.$element = null;
			self.element = null;
			
			var initElement = function() {
				self.$container.find("#mssfb-call-conversation").remove();
				var $convo = $("<div id='mssfb-call-conversation'></div>");
				self.$container.append($convo);
				self.$element = $convo;
				self.element = self.$element.get(0);
			};
			//initElement();
			
			var callHandlers = function(handrels) {
				for (var i=0; i<handrels.length; i++) {
					handrels[i](self.$element);
				}
			};
			
			this.init = function() {
				initElement();
				conversation = null;
				callerId = null;
				attached = true;
				return this;
			};
			
			this.getConversation = function() {
				return conversation;
			};
			
			this.getCallerId = function() {
				return callerId;
			};
			
			this.setConversation = function(convoInstance, caller) {
				conversation = convoInstance;
				callerId = caller;
			};
			
			this.isAttached = function() {
				return attached;
			};
			
			this.attached = function() {
				attached = true;
			};
			
			this.detached = function() {
				attached = false;
			};
			
			this.show = function() {
				callHandlers(onMssfbCallShow);
				return this;
			};
			
			this.hide = function() {
				callHandlers(onMssfbCallHide);
				return this;
			};
			
			this.onShow = function(handler) {
				if (handler) {
					onMssfbCallShow.push(handler);
				}
				return this;
			};
			
			this.onHide = function(handler) {
				if (handler) {
					onMssfbCallHide.push(handler);
				}
				return this;
			};
		}
		
		function SfBProvider() {
			var EMAIL_PATTERN = /\S+@\S+[\.]*\S+/;
			
			var TOKEN_STORE = "mssfb_login_token";
			
			var MSONLINE_LOGIN_PREFIX = "https://login.microsoftonline.com";
			
			var self = this;
			var settings, currentKey;
			var apiInstance, appInstance, uiApiInstance, uiAppInstance;
			
			var localConvos = {};
			
			var isMac = navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
			var isWindows = navigator.userAgent.toUpperCase().indexOf("WINDOWS") >= 0;
			
			var isClosed = false;
			var onClosePage = function(conversation, app) {
				if (!isClosed && conversation && app) {
					// TODO In WebKIT browsers this stuff doesn't work and outgoing call still may run for the remote party if
					// simply close the window. It is caused by the browser implementation, in WebKIT it doesn't let asynchronous
					// requests to work on this stage, but if user will click to stay(!) on the page, then this code will be
					// proceeded and the call ended.
					// In IE and FF (but not for video/audio in FF currently, Apr 26 2017), this code will be
					// executed by the browser and call rejected or stopped.
					conversation.leave().then(function() {
						app.conversationsManager.conversations.remove(conversation);
						log("<<<< conversation leaved");
						isClosed = true;
					});
					//conversation.selfParticipant.reset();
					// TODO what a right approach to leave the convo? 
					// conversation.videoService.stop();
					// conversation.audioService.stop();
					// conversation.chatService.stop();
					// uiApp.signInManager.signOut().then(function() {
					// log("<<<< Skype signed out");
					// }, function(error) {
					// log("<<<< Error signing out Skype:" + error);
					// });
					return "You canceled the call";
				}
			}
			
			var authRedirectLink = function(title, clientId, redirectUri, resource) {
				var loginUri = MSONLINE_LOGIN_PREFIX + "/common/oauth2/authorize?response_type=token&client_id="
					+ clientId
					+ "&redirect_uri="
					+ encodeURIComponent(redirectUri)
					+ "&resource="
					+ encodeURIComponent(resource);
				return loginUri;
			};
			
			var authRedirectWindow = function(title, clientId, redirectUri, resource) {
				var loginUri = authRedirectLink(title, clientId, redirectUri, resource);
				log("SfB login/call: " + loginUri);
				var theWindow = videoCalls.showCallPopup(loginUri, title);
				return theWindow;
			};
			
			var notifyCaller = function(destWindow, title, message) {
				if (destWindow.notifyUser) {
					destWindow.notifyUser({
						title : title, 
						text : message							        
					});
				} else {
					setTimeout($.proxy(notifyCaller, this), 250, destWindow, title, message);
				}
			};
			
			var tokenHashInfo = function(hline) {
				var tokenEnd = hline.indexOf("&token_type");
				if (tokenEnd > 0) {
					var start = tokenEnd - 7;
					if (hline.length - start > 0) {
						return hline.substring(start);
					} else {
						log(">> tokenHashInfo: unexpected hash line format: " + hline);
					}
				}
				return hline; 
			};
			this.tokenHashInfo = tokenHashInfo;
			
			var saveLocalToken = function(token) {
				log(">> saveLocalToken: " + tokenHashInfo(token.hash_line));
				if (typeof(Storage) !== "undefined") {
			    // Code for localStorage/sessionStorage.
			  	localStorage.setItem(TOKEN_STORE, JSON.stringify(token));
				} else {
				  // Sorry! No Web Storage support.
					// TODO save it in session storage or server-side?
					if (eXo && eXo.videoCalls && eXo.videoCalls.mssfb) {
						eXo.videoCalls.mssfb.__localToken = token;
						log("WARN access token saved only in this window, not local storage!");
					} else {
						log("ERROR saving access token: local storage not supported.");
					}
				}
			};
			this.saveToken = function(token) {
				saveLocalToken(token);
			};
			var currentToken = function() {
				var token;
				if (typeof(Storage) !== "undefined") {
					var savedToken = localStorage.getItem(TOKEN_STORE);
					if (savedToken) {
						// TODO in Session Storage we can find "swx-sessionid" it appears when SDK logged in, 
						// this record can be used as a flag of active session
						// TODO there are also several records in Local Storage
						try {
							token = JSON.parse(savedToken);
						} catch(e) {
							log("Login (saved) parsing error: " + e, e);
							localStorage.removeItem(TOKEN_STORE);
						}		
					} else {
						log("Login (saved) token not found");
					}
				} else if (eXo && eXo.videoCalls && eXo.videoCalls.mssfb) {
					token = eXo.videoCalls.mssfb.__localToken;
				}
				if (token) {
					// cut a gap in 20sec for actual request processing
					var expiresIn = token.created + token.expires_in - 20;
					var now = new Date().getTime()/1000;
					if (now >= expiresIn) {
						// token expired
						log("Login (saved) token expired");
						token = null;
					} else {
						// else, we can use current token
						log(">> currentToken: " + tokenHashInfo(token.hash_line));
					}
				}
				return token;
			};
			
			var callUri = function(callId, title, hashLine) {
				var q;
				var currentSpaceId = videoCalls.getCurrentSpaceId();
				var currentRoomTitle = videoCalls.getCurrentRoomTitle();
				if (currentSpaceId) {
					q = "space=" + encodeURIComponent(currentSpaceId);
				} else if (currentRoomTitle) {
					q = "room=" + encodeURIComponent(currentRoomTitle);
				}
				if (title) {
					if (q) {
						q += "&";
					}
					q += "title=" + encodeURIComponent(title);
				}
				var uri = videoCalls.getBaseUrl() + "/portal/skype/call/" + callId + "?" + q;
				if (hashLine) {
					uri += hashLine;
				}
				return uri;
			};
			
			var openCallWindow = function(callId, title) {
				var token = currentToken();
				// TODO check if such window isn't already open by this app
				if (token) {
					// use existing token
					var uri = callUri(callId, title, token.hash_line);
					return videoCalls.showCallPopup(uri, title);
				} else {
					// open SfB login window with redirect to the call URI
					var uri = callUri(callId, title);
					return authRedirectWindow(title, settings.clientId, uri, "https://webdir.online.lync.com");
				}
			};
			
			var getSDKErrorData = function(sdkErr) {
				var r = sdkErr ? (sdkErr.rsp ? sdkErr.rsp : (sdkErr.req ? sdkErr.req : null)) : null;
				return r && r.data ? r.data : null;
			};
			
			var handleErrorData = function(callId, title, errData) {
				log(">>> call " + callId + " ERROR: " + errData.code + " " + (errData.subcode ? errData.subcode + " " : "") + errData.message);
				if (errData.code == "Gone" && errData.subcode == "TooManyApplications") {
					videoCalls.showError(title, "Too many applications. " + errData.message);	
				} else {
					videoCalls.showError(title, "[" + errData.code + "] " + errData.message);
				}
			};
			
			this.getType = function() {
				if (settings) {
					return settings.type;
				}
			};
			
			this.getSupportedTypes = function() {
				if (settings) {
					return settings.supportedTypes;
				}
			};

			this.getTitle = function() {
				if (settings) {
					return settings.title;
				}
			};

			this.getCallTitle = function() {
				if (settings) {
					return settings.callTitle;
				}
			};

			this.getClientId = function() {
				if (settings) {
					return settings.clientId;
				}
			};

			this.configure = function(skypeEnv) {
				settings = skypeEnv;
				// TODO do some validation of given settings?
				// Skype Configuration: apiKey for SDK, apiKeyCC for SDK+UI
			};

			this.isConfigured = function() {
				return settings != null;
			};

			this.application = function(redirectUri, getOAuthToken) {
				var initializer = $.Deferred();
				if (settings) {
					if (apiInstance && appInstance) {
						log("Use app instance");
						initializer.resolve(apiInstance, appInstance);
					} else {
						var user = videoCalls.getUser();
						var sessionId = user.id + "_session" + Math.floor((Math.random() * 1000000) + 1);
						log("app sessionId='" + sessionId + "'");
						Skype.initialize({
							"version" : settings.version,
							"apiKey" : settings.apiKey,
							"correlationIds" : {
								"sessionId" : sessionId
							// Necessary for troubleshooting requests, should be unique per session
							}
						}, function(api) {
							var app = new api.application();
							// SignIn SfB Online: the SDK will get its own access token
							if (!redirectUri) {
								redirectUri = redirectUri ? redirectUri : settings.redirectUri; 
							}
							log("app redirectUri='" + redirectUri + "'");
							log("app clientId='" + settings.clientId + "'");
							var args = {
								"client_id" : settings.clientId,
								"origins" : settings.origins,
								"cors" : true,
								"version" : settings.version
							// Necessary for troubleshooting requests; identifies your application in our telemetry
							};
							if (getOAuthToken && typeof(getOAuthToken) === "function") {
								args.get_oauth_token = getOAuthToken;
							} else {
								args.redirect_uri = redirectUri;
							}
							app.signInManager.signIn(args).then(function(res) {
								log("Skype signed in as " + app.personsAndGroupsManager.mePerson.displayName());
								// ensure local and remote users are of the same account in MS
								var exoUserSFB = videoCalls.imAccount(user, "mssfb");
								var mssfbUserId = app.personsAndGroupsManager.mePerson.id(); // sip:email...
								if (exoUserSFB && exoUserSFB.id != mssfbUserId) {
									// bad, we cannot proceed - need ask local user login with his account in MS
									log("Skype user and local eXo user have different Microsoft IDs: " + mssfbUserId + " vs " + exoUserSFB.id);
									initializer.reject("Skype user signed in under different account: " + mssfbUserId +
											". Please login as " + exoUserSFB.id);
								} else {
									// else, we don't care here if it is SfB user on eXo side
									apiInstance = api;
									appInstance = app;
									initializer.resolve(api, app);
								}
							}, function(err) {
								log("Cannot sign in Skype", err);
								initializer.reject(err);
							});

							// whenever client.state changes, display its value
							app.signInManager.state.changed(function(state) {
								// TODO update user state and UI in PLF page
								log("State change:" + JSON.stringify(state));
							});
						}, function(err) {
							log("Cannot load Skype SDK.", err);
							initializer.reject(err);
						});
					}
				} else {
					initializer.reject("Skype settings not found");
				}
				return initializer.promise();
			};

			this.uiApplication = function(redirectUri) {
				var initializer = $.Deferred();
				if (settings) {
					if (uiApiInstance && uiAppInstance) {
						log("Use uiApp instance");
						initializer.resolve(uiApiInstance, uiAppInstance);
					} else {
						var user = videoCalls.getUser();
						var sessionId = user.id + "_uisession" + Math.floor((Math.random() * 1000000) + 1);
						log("uiApp sessionId='" + sessionId + "'");
						Skype.initialize({
							"version" : settings.version,
							"apiKey" : settings.apiKeyCC,
							"correlationIds" : {
								"sessionId" : sessionId
							// Necessary for troubleshooting requests, should be unique per session
							}
						}, function(api) {
							var app = api.UIApplicationInstance;
							// SignIn SfB Online: the SDK will get its own access token
							if (!redirectUri) {
								redirectUri = redirectUri ? redirectUri : settings.redirectUri; 
							}
							log("uiApp redirectUri='" + redirectUri + "'");
							log("uiApp clientId='" + settings.clientId + "'");
							app.signInManager.signIn({
								"client_id" : settings.clientId,
								"origins" : settings.origins,
								"cors" : true,
								"redirect_uri" : redirectUri,
								"version" : settings.version
							// Necessary for troubleshooting requests; identifies your application in our telemetry
							}).then(function() {
								log("SkypeCC signed in as " + app.personsAndGroupsManager.mePerson.displayName());
								// ensure local and remote users are of the same account in MS
								var exoUserSFB = videoCalls.imAccount(user, "mssfb");
								var mssfbUserId = app.personsAndGroupsManager.mePerson.id(); // sip:email...
								if (exoUserSFB && exoUserSFB.id != mssfbUserId) {
									// bad, we cannot proceed - need ask local user login with his account in MS
									log("Skype user and local eXo user have different Microsoft IDs: " + mssfbUserId + " vs " + exoUserSFB.id);
									initializer.reject("Skype user signed in under different account: " + mssfbUserId +
											". Please login as " + exoUserSFB.id);
								} else {
									// else, we don't care here if it is SfB user on eXo side
									uiApiInstance = api;
									uiAppInstance = app;
									initializer.resolve(api, app);
								}
							}, function(err) {
								log("Cannot sign in SkypeCC", err);
								initializer.reject(err);
							});

							// whenever client.state changes, display its value
							app.signInManager.state.changed(function(state) {
								// TODO update user state and UI in PLF page
								log("StateCC change:" + JSON.stringify(state));
							});
						}, function(err) {
							log("Cannot load SkypeCC SDK.", err);
							initializer.reject(err);
						});
					}
				} else {
					initializer.reject("Skype settings not found");
				}
				return initializer.promise();
			};

			//////////////// Call handlers //////////////////
			
			// Check if Skype web plugin installed
			var checkPlugin = function(app) {
				var process = $.Deferred();
				var cap = app.devicesManager.mediaCapabilities;
				if (cap.isBrowserMediaSupported() || cap.isPluginInstalled()) {
					// everything OK
					process.resolve(false);
				} else {
					cap.installedVersion.get().finally(function() {
						function pluginLink() {
							var link;
							if (isWindows) {
								link = cap.pluginDownloadLinks("msi");
								if (!link) {
									link = cap.pluginDownloadLinks("exe");
								}
							} else if (isMac) {
								link = cap.pluginDownloadLinks("pkg");
								if (!link) {
									link = cap.pluginDownloadLinks("dmg");
								}
							}
							if (!link) {
								link = "https://support.skype.com/en/faq/FA12316/what-is-the-skype-web-plugin-and-how-do-i-install-it";
							}
							return link;
						}
						var p = cap.isPluginInstalled;
						var r = p.reason;
						if (p()) {
							if (r == "CompatiblePluginInstalled") {
						     // optional:
						     // tell user which version is detected: cap.installedVersion()
						     // recommend user to upgrade plugin to latest
						     // using cap.pluginDownloadLinks('msi') etc.
								videoCalls.showWarn("Skype web plugin upgrade", "You are using obsolete version of Skype plugin. <a " +
										"href='" + pluginLink() + "' target='_blank' class='pnotifyTextLink'>Latest version</a> can be installed.");	
								process.resolve(true); // true - means user action recommended
						  } else {
						  	process.resolve(false);
						  }
						} else {
							var installedVersion;
							var stateText = "not found";
							if (r == "ObsoletePluginInstalled") {
								// tell user which version is detected: cap.installedVersion()
								installedVersion = cap.installedVersion();
								stateText = "obsolete";
							} else if (r == "NoPluginInstalled") {
						    // tell user no plugin is detected
								stateText = "not installed";
							}
							// recommend user to upgrade plugin to latest
							// using cap.pluginDownloadLinks('msi') etc.
							videoCalls.showWarn("Skype web plugin " + stateText, "You need install supported Skype plugin <a " +
										"href='" + pluginLink() + "' target='_blank' class='pnotifyTextLink'>version</a>." + 
										(installedVersion ? " Current installed version is " + installedVersion + "." : ""));
							process.reject();
						}
					});
				}
				return process.promise();
			};
			var loginUri = videoCalls.getBaseUrl() + "/portal/skype/call/login";
			var loginWindow = function() {
				return authRedirectWindow("Skype for Business Login", settings.clientId, loginUri, "https://webdir.online.lync.com");
			};
			var loginIframe;
			var loginTokenUpdater;
			var loginTokenHandler = function(token) {
				delete provider.loginToken;
				var process = $.Deferred();
				try {
					if (loginTokenUpdater) {
						clearTimeout(loginTokenUpdater);
					}
					var prevHash = location.hash;
					if (prevHash && prevHash.indexOf("access_token") >= 0) {
						log(">> loginTokenHandler WARN loading on page with access_token in the hash: " + prevHash);
					}
					location.hash = token.hash_line;
					var appInitializer = provider.uiApplication(loginUri);
					appInitializer.done(function(api, app) {
						// TODO save token in the server-side for late use
					  log("Login OK, app created OK");
					  // Save the token hash in local storage for later use
					  location.hash = prevHash;
					  saveLocalToken(token);
					  process.resolve(api, app);
					  // Remove warnings if any
					  // TODO check exactly that the SfB authorized 
						$(".mssfbLoginWarningContainer").remove();
					  // TODO care about token renewal
						loginTokenUpdater = setTimeout(function() {
							loginTokenUpdater = null;
							loginIframe().done(function() {
								log(">>> updated login token to: " + token.created);
							}).fail(function(err) {
								log(">>> ERROR updating login token: " + err);
							});
						}, (token.expires_in - 60) * 1000);
					});
					appInitializer.fail(function(err) {
						log("Login error: " + JSON.stringify(err));
						location.hash = prevHash;
						process.reject(err);
					});
				} catch(e) {
					log("Error handling login token", e);
					process.reject(e);
				}
				return process.promise();
			};
			loginIframe = function() {
				var process = $.Deferred();
				// FYI if user not authorized (in cookies etc) this iframe will fail due to 'X-Frame-Options' to 'deny' set by MS
				// TODO may be another URL found to do this?
				var iframeUri = authRedirectLink(provider.getTitle() + " Login", settings.clientId, loginUri, "https://webdir.online.lync.com");
				var $iframe = $("<iframe src='" + iframeUri + "' height='0' width='0' style='display: none;'></iframe>");
				provider.loginToken = function(token) {
					var callback = loginTokenHandler(token);
					callback.done(function(api, app) {
						process.resolve(api, app);
					});
					callback.fail(function(err) {
						process.reject(err);
					});
					callback.always(function() {
						$iframe.remove();
					});
					return callback.promise();
				};
				setTimeout(function() {
					// check if $iframe not stays on MS server: it will mean we need login user explicitly
					try {
						//$iframe.ready(function(){
							var iframeLocation = $iframe.get(0).contentWindow.location;
							var checkUri = iframeLocation.origin + iframeLocation.pathname;
							// if iframe accessed ok, then it's eXo server URL, not MS login
							log("Login iframe check DONE: " + checkUri);
						//});								
					} catch (e) {
						// it's an error, like DOMException for
						$iframe.remove();
						delete provider.loginToken;
						log("Login iframe check FAILED", e);
						process.reject("User not logged in");
					}
				}, 3000);
				$(document.body).append($iframe);
				return process.promise();
			};
			
			var getCallId = function(c) {
				if (c.isGroupConversation()) {
					var curi = c.uri();
					if (curi) {
						return "g/" + curi;
					} else if (c.state() != "Created") {
						log(">> ERROR: group conversation not Created but without URI");
					}
					return null;
				} else {
					var state = c.state();
					var id = "p/";
					var creatorId = c.creator.id();
					var myId = c.selfParticipant.person.id();
					var p1 = c.participants(0);
					if (p1) {
						var p1Id = p1.person.id();
						if (creatorId != p1Id) {
							id += creatorId + ";" + p1Id;	
						} else if (creatorId != myId) {
							id += creatorId + ";" + myId;
						} else {
							id += creatorId;
						}
					} else {
						id += myId;
					}
					return id;
				}
			};
			this.getCallId = getCallId;
			var logging = {};
			var logConversation = function(c, key, index) {
				var key = key ? key : (c.id ? c.id() : null);
				if (key) { 
					if (logging[key]) {
						// already tracked
						log(">> Log (already) CONVERSATION " + getCallId(c) + " state:" + c.state() + (key ? " key:" + key : "") + (index ? " index:" + index : ""));
						return;
					} else {
						logging[key] = true;
					}
				}
				log(">> Log CONVERSATION " + getCallId(c) + (key ? " key:" + key : "") + (index ? " index:" + index : ""));
				c.state.changed(function(newValue, reason, oldValue) {
					log(">>> CONVERSATION " + getCallId(c) + (key ? " (" + key + ")" : "") + " state: " + oldValue + "->" + newValue + " reason:" + reason);
				});					
			};
			this.logConversation = logConversation;
			var isModalityUnsupported = function(error) {
				// TODO CommandDisabled also will appear for state of previously disconnected convo
				// AssertionFailed happens in Chrome when Video cannot be rendered
				if (error.code == "CommandDisabled" || error.code == "AssertionFailed" || (error.code == "InvitationFailed" && error.reason.subcode == "UnsupportedMediaType")) {
					return true;
				}
				return false;
			};
			this.isModalityUnsupported = isModalityUnsupported;
			
			// target, participants, localConvo
			var outgoingCallHandler = function(api, app, container, target, participants, users, conversation) {
				var process = $.Deferred();
				container.init();
				checkPlugin(app).done(function() {
					var options = {
								modalities : [ "Chat" ]
					};
					if (conversation) {
						// it's existing conversation, it was running in this app/page
						options.conversation = conversation;
					} else {
						if (target.group) {
							if (target.callId) {
								// reuse existing group convo: cut 'g/' from the call id - it's a SIP URI
								var conversation = app.conversationsManager.getConversationByUri(target.callId.substring(2));
								if (conversation) {
									options.conversation = conversation;								
								} else {
									log("Group conversation not found " + target.callId + " for call '" + target.title + "'");
									options.participants = participants;
								}
							} else {
								var conversation = app.conversationsManager.createConversation();
								for (var i=0; i<participants.length; i++) {
									var imId = participants[i];
									try {
										var remoteParty = conversation.createParticipant(imId);
										conversation.participants.add(remoteParty);
									} catch(e) {
										log(">>> Error creating group participant " + imId, e);
										for (var i=0; i<users.length; i++) {
											if (videoCalls.imAccount(users[i], "mssfb") == imId) {
												users.splice(i, 1);
												break;
											}
										}
									}
								}
								options.conversation = conversation;
							}
						} else {
							options.participants = participants;
						}
					}
					api.renderConversation(container.element, options).then(function(conversation) {
						logConversation(conversation);
						container.setConversation(conversation, target.title);
						container.show();
						// TODO in case of video error, but audio or chat success - show a hint message to an user and auto-hide it
						var callId = getCallId(conversation);
						log("Outgoing call '" + target.title + "' " + callId);
						var beforeunloadListener = function(e) {
							var msg = onClosePage(conversation, app);
							if (msg) {
								e.returnValue = msg; // Gecko, Trident, Chrome 34+
								return msg; // Gecko, WebKit, Chrome <34
							}
						};
						var unloadListener = function(e) {
							onClosePage(conversation, app);
						};
						var pluginError;
						var handleError = function(error) {
							var title = "Error starting call";
							if (error) {
								if (error.reason && error.reason.subcode && error.reason.message) {
									log(">>> call " + callId + " ERROR: " + error.reason.subcode + ". " + error.reason.message);
									videoCalls.showError(title, error.reason.message);
								} else {
									// TODO {"code":"CommandDisabled"}? 
									// {"code":"AssertionFailed"}? happens in Chrome when Video cannot be rendered
									if (error.code && error.code == "Canceled") {
										// Do nothing
									} else {
										var errData = getSDKErrorData(error);
										if (errData) {
											handleErrorData(callId, title, errData);
										} else {
											videoCalls.showError(title, error);
										}
									}
								}
							}
							// For a case when Disconnected will not happen
							window.removeEventListener("beforeunload", beforeunloadListener);
							window.removeEventListener("unload", unloadListener);
						};
						var registered = false;
						var registerCall = function() {
							if (!registered && callId != "g/adhoc") {
								log(">>> Registering " + callId + " > " + new Date().getTime());
								registered = true;
								var ownerType = target.type;
								var ownerId = target.id;
								/*if (conversation.isGroupConversation()) {
									var spaceId = videoCalls.getCurrentSpaceId();
									if (spaceId != null) {
										ownerId = spaceId;
										ownerType = "space";
									} else {
										var roomTitle = videoCalls.getCurrentRoomTitle();
										if (roomTitle != null) {
											ownerId = roomTitle;
											ownerType = "chat_room";
										}
									}
									// we assume it's custom Chat room
								} else {
									ownerId = videoCalls.getUser().id;
									ownerType = "user";
								}*/
								// call creator goes first in the ID of p2p
								var participants = [];
								for (var i=0; i<users.length; i++) {
									//var pid = conversation.participants(i).person.id();
									participants.push(users[i].id);
								}
								var callInfo = {
									owner : ownerId,
									ownerType : ownerType,  
									provider : provider.getType(),
									title : conversation.topic(),
									participants : participants.join(";")
								};
								videoCalls.registerCall(callId, callInfo).done(function(call) {
									log(">>> Registered " + callId + " > " + new Date().getTime());
								}).fail(function(err) {
									registered = false;
									log(">>> ERROR registering " + callId + ": " + JSON.stringify(err));
								});
							}
						};
						var unregisterCall = function() {
							if (registered) {
								log(">>> Unregistering " + callId + " > " + new Date().getTime());
								videoCalls.unregisterCall(callId).done(function(call) {
									log("<<< Unregistered " + callId + " > " + new Date().getTime());
									registered = false;
								}).fail(function(err) {
									log("<<< ERROR unregistering " + callId + ": " + JSON.stringify(err));
								});								
							}
						};
						if (target.group && conversation.selfParticipant.person.id() == conversation.creator.id()) {
							// set topic only if a creator and of a group call, 
							// otherwise it's R/O property for other parts and for p2p we don't want set any topic now
							try {
								conversation.topic(target.title);
							} catch(e) {
								log(">>> Error setting conversation topic: " + target.title, e);
							}
						}
						if (callId && callId.indexOf("sip:") > 0) {
							registerCall();
						} else {
							log(">>> Call ID not complete: " + callId);
						}
						var started = false;
						var startingCall = function(stateName) {
							if (!started) {
								started = true;
								callId = getCallId(conversation);
								log(">>> " + stateName + " outgoing " + callId);
								registerCall();
								process.resolve(callId, conversation);
								/*conversation.state.once("Connected", function() {
									// FIXME several such listeners may register if convo was declined remotely or filed to connect
									log(">>> Connected outgoing " + callId);
									process.resolve(callId, conversation);
								});*/
								conversation.state.once("Disconnected", function() {
									log("<<< Disconnected outgoing " + callId);
									unregisterCall();
									//app.conversationsManager.conversations.remove(conversation);
									window.removeEventListener("beforeunload", beforeunloadListener);
									window.removeEventListener("unload", unloadListener);
									//container.hide();
									if (process.state() == "pending") {
										process.reject("disconnected");
									}
								});								
							}
						};
						if (conversation.isGroupConversation()) {
							/*conversation.state.once("Conferencing", function() {
								startingCall("Conferencing");
							});							
							conversation.state.once("Conferenced", function() {
								startingCall("Conferenced");
							});*/
						} else {
							conversation.state.once("Connecting", function() {
								startingCall("Connecting");
							});
						}
						conversation.videoService.start().then(function() {
							log(">>> Outgoing video STARTED ");
							startingCall("Started");
						}, function(videoError) {
							// error starting videoService, cancel (by this user) also will go here
							log("<<< Error starting outgoing video: " + JSON.stringify(videoError));
							var finisWithError = function(error) {
								unregisterCall(); // TODO don't need it here, will it be done on Disconnected state?
								handleError(error);
								if (process.state() == "pending") {
									process.reject(error);
								}
							};
							if (isModalityUnsupported(videoError)) {
								// ok, try audio
								conversation.audioService.start().then(function() {
									log(">>> Outgoing audio STARTED ");
									startingCall("Started");
								}, function(audioError) {
									log("<<< Error starting outgoing audio: " + JSON.stringify(audioError));
									if (isModalityUnsupported(audioError)) {
										// well, it will be chat (it should work everywhere)
										conversation.chatService.start().then(function() {
											log(">>> Outgoing chat STARTED ");
										}, function(chatError) {
											log("<<< Error starting outgoing chat: " + JSON.stringify(chatError));
											// we show original error
											finisWithError(videoError);
										});
									} else {
										finisWithError(videoError);
									}
								});
							} else {
								finisWithError(videoError);
							}
						});
						window.addEventListener("beforeunload", beforeunloadListener);
						window.addEventListener("unload", unloadListener);
					}, function(err) {
						// error rendering Conversation Control
						container.hide();
						process.reject(err);
						if (err.name && err.message) {
							log("<<< conversation rendering error: " + err.name + " " + err.message, err);
							videoCalls.showError(err.name, err.message);
						} else {
							log("<<< conversation rendering error: " + JSON.stringify(err));
						}
					});					
				}).fail(function() {
					container.$element.append($("<div><div class='pluginError'>Please install Skype web plugin.</div></div>"));
					process.reject("plugin error");
				});
				return process.promise();
			};
			
			var makeCallPopover = function(title, message) {
				// TODO show an info popover in bottom right corner of the screen as specified in CALLEE_01
				log(">> makeCallPopover '" + title + "' message:" + message);
				var process = $.Deferred();
				var $call = $("div.uiOutgoingCall");
				if ($call.length > 0) {
					try {
						$call.dialog("destroy");
					} catch(e) {
						log(">>> makeCallPopover: error destroing prev dialog ", e);
					}
					$call.remove();
				}
				$call = $("<div class='uiOutgoingCall' title='" + title + " call'></div>");
				$call.append($("<p><span class='ui-icon messageIcon' style='float:left; margin:12px 12px 20px 0;'></span>"
					//+ "<a target='_self' href='" + callerLink + "'><img src='" + callerAvatar + "'></a>"
					+ "<div class='messageText'>" + message + "</div></p>"));
				$(document.body).append($call);
				$call.dialog({
		      resizable: false,
		      height: "auto",
		      width: 400,
		      modal: false,
		      buttons: {
		        "Call": function() {
		        	process.resolve("confirmed");
		        	$call.dialog( "close" );
		        },
		        "Cancel": function() {
		        	process.reject("canceled");
		        	$call.dialog( "close" );
		        }
		      }
				});
				return process.promise();
			};
			
			this.callButton = function(context) {
				var button = $.Deferred();
				if (settings && context && context.currentUser) {
					// TODO temporarily we don't support calling regular Skype users
					//context.currentUserSkype = videoCalls.imAccount(context.currentUser, "skype");
					var currentUserSFB = videoCalls.imAccount(context.currentUser, "mssfb");
					if (currentUserSFB) {
						context.currentUserSFB = currentUserSFB;
						context.details().done(function(target) { // users, convName, convTitle
							//var rndText = Math.floor((Math.random() * 1000000) + 1);
							//var linkId = "SkypeCall-" + target.name + "-" + rndText;
							// TODO i18n for title
							/*var title = target.title;
							var groupCallId;
							if (context.spaceId) {
								groupCallId = context.target.callId;
							} else if (context.roomId && context.isGroup) {
								groupCallId = context.target.callId;									
							}*/
							var ims = []; // for call on a new page
							var participants = []; // for embedded call
							var participantUsers = [];
							var wrongUsers = [];
							var addParticipant = function(user) {
								//var uskype = videoCalls.imAccount(u, "skype");
								var ubusiness = videoCalls.imAccount(user, "mssfb");
								if (ubusiness) {
									if (ubusiness.id != context.currentUserSFB.id) {
										if (EMAIL_PATTERN.test(ubusiness.id)) {
											participants.push(ubusiness.id);
											participantUsers.push(user);
											ims.push(encodeURIComponent(ubusiness.id));
										} else {
											wrongUsers.push(ubusiness);
										}
									}
								} // else, skip this user
							};
							if (target.group) {
								for ( var uname in target.members) {
									if (target.members.hasOwnProperty(uname)) {
										var u = target.members[uname];
										addParticipant(u);
									}
								}								
							} else {
								addParticipant(target);
							}
							var showWrongUsers = function(callWindow) {
								if (wrongUsers.length > 0) {
									var userNames = "";
									for (var i=0; i<wrongUsers.length; i++) {
										if (i > 0) {
											userNames += ", ";
										}
										var wu = wrongUsers[i];
										userNames += wu.firstName + " " + wu.lastName;
									}
									var s, have, who; 
									if (wrongUsers.length > 1) {
										s = "s";
										have = "have";
										who = "They were";
									} else {
										s = "";
										have = "has";
										who = "It was";
									}
									var title = "Wrong Skype account" + s;
									var message = "Following user" + s + " " + have + " wrong business account: " + 
										userNames + ". " + who + " not added to the call.";
									log(title, message);
									if (callWindow) {
										// inform the caller in call window
										$(callWindow).on("load", function() {
											notifyCaller(callWindow, title, message);
										});
									} else {
										// inform on this page
										videoCalls.showWarn(title, message);
									}
								}
							};
							if (participants.length > 0) {
								var $button = $("<a title='" + target.title // id='" + linkId + "' 
											+ "' href='javascript:void(0);' class='mssfbCallAction'>"
											+ "<i class='uiIconMssfbCall uiIconForum uiIconLightGray'></i>"
													+ "<span class='callTitle'>" + self.getCallTitle() + "</span></a>");
								if (target.callId) {
									$button.data("callid", target.callId);
								}
								setTimeout(function() {
									if (!$button.hasClass("btn")) {
										// in dropdown show longer description
										$button.find(".callTitle").text(self.getTitle() + " " + self.getCallTitle());
									}
								}, 1000);
								$button.click(function() {
									// find if it's not locally run convo
									//app.conversationsManager.conversations();
									var saveConvo = function(callId, conversation) {
										log(">>> saveConvo: " + callId);
										localConvos[callId] = conversation;
										$button.data("callid", callId);
									};
									var localConvo;
									var callId = $button.data("callid");
									if (callId) {
										localConvo = localConvos[callId];
									}
									var container = $("#mssfb-call-container").data("callcontainer");
									if (container) {
										// Call from Chat room on the same page
										// We will try reuse saved locally SfB token
										var token = currentToken();
										if (token && uiApiInstance && uiAppInstance) {
											//initializer.resolve(uiApiInstance, uiAppInstance);
											log("Automatic login done.");
											outgoingCallHandler(uiApiInstance, uiAppInstance, container, target, participants, participantUsers, localConvo).done(saveConvo);
											showWrongUsers(null);
										} else {
											// we need try SfB login window in hidden iframe (if user already logged in AD, then it will work)
											// FYI this iframe will fail due to 'X-Frame-Options' to 'deny' set by MS
											// TODO may be another URL found to do this? - see incoming call handler for code
											//initializer.reject("Login token not found or expired");
											// need login user explicitly (in a popup)
											log("Automatic login failed: login token not found or expired");
											loginWindow();
											provider.loginToken = function(token) {
												var callback = loginTokenHandler(token);
												callback.done(function(api, app) {
													log("User login done.");
													makeCallPopover("Make " + provider.getTitle() + " call?", "Do you want call " + target.title + "?").done(function() {
														outgoingCallHandler(api, app, container, target, participants, participantUsers, localConvo).done(saveConvo);														
													}).fail(function() {
														log("User don't want make a call: " + target.title);
													});
												});
												callback.fail(function(err) {
													videoCalls.showError(provider.getTitle() + " error", "Unable sign in your " + provider.getTitle() + " account. " + err);
												});
												return callback.promise();
											}
										}
									} else {
										// XXX for calling from spaces and user popovers outside Chat app
										var callWindow = openCallWindow("_/" + ims.join(";"), target.title + " call");
										showWrongUsers(callWindow);
									}
								});
								button.resolve($button);
							} else {
								button.reject("No " + self.getTitle() + " users found");
							}
						}).fail(function(err) {
							button.reject("Error getting participants for " + self.getTitle() + ": " + err);
						});
					} else {
						button.reject("Not SfB user");
					}
				} else {
					button.reject("Not configured or empty context for " + self.getTitle());
				}
				return button.promise();
			};
				
			var acceptCallPopover = function(callerLink, callerAvatar, callerMessage) {
				// TODO show an info popover in bottom right corner of the screen as specified in CALLEE_01
				log(">> acceptCallPopover '" + callerMessage + "' caler:" + callerLink + " avatar:" + callerAvatar);
				var process = $.Deferred();
				var $call = $("div.uiIncomingCall");
				if ($call.length > 0) {
					try {
						$call.dialog("destroy");
					} catch(e) {
						log(">>> acceptCallPopover: error destroing prev dialog ", e);
					}
					$call.remove();
				}
				$call = $("<div class='uiIncomingCall' title='" + provider.getTitle() + " call'></div>");
				//<span class='ui-icon messageIcon' style='float:left; margin:12px 12px 20px 0;'></span>
				$call.append($("<div class='messageAuthor'><a target='_blank' href='" + callerLink + "' class='avatarMedium'>"
					+ "<img src='" + callerAvatar + "'></a></div>"
					+ "<div class='messageBody'><div class='messageText'>" + callerMessage + "</div></div>"));
				// eXo UX guides way
				//$call.append($("<ul class='singleMessage popupMessage'><li><span class='messageAuthor'>"
				//		+ "<a class='avatarMedium'><img src='" + callerAvatar + "'></a></span>"
				//		+ "<span class='messageText'>" + callerMessage + "</span></li></ul>"));
				$(document.body).append($call);
				$call.dialog({
		      resizable: false,
		      height: "auto",
		      width: 400,
		      modal: false,
		      buttons: {
		        "Answer": function() {
		        	process.resolve("accepted");
		        	$call.dialog( "close" );
		        },
		        "Decline": function() {
		        	process.reject("declined");
		        	$call.dialog( "close" );
		        }
		      }
				});
				process.notify($call);
				return process.promise();
			};
			
			var incomingCallHandler = function(api, app, tokenHash, container) {
				// We want handle both "Incoming" added by remote part and "Created" added here as outgoing and later re-used as "Incoming"
				checkPlugin(app).done(function() {
					app.conversationsManager.conversations.removed(function (conversation, key, index) {
						var callId = getCallId(conversation);
						delete localConvos[callId];
						delete logging[key];
					});
					app.conversationsManager.conversations.added(function (conversation, key, index) {
						var callId = getCallId(conversation);
						logConversation(conversation, key, index);
						var state = conversation.state();
						log(state + " call: " + callId);
						var beforeunloadListener = function(e) {
							var msg = onClosePage(conversation, app);
							if (msg) {
								e.returnValue = msg; // Gecko, Trident, Chrome 34+
								return msg; // Gecko, WebKit, Chrome <34
							}
						};
						var unloadListener = function(e) {
							onClosePage(conversation, app);
						};
						var handleError = function(error) {
							var title = "Error starting call";
							if (error) {
								if (error.reason && error.reason.subcode && error.reason.message) {
									log(">>> call " + callId + " ERROR: " + error.reason.subcode + ". " + error.reason.message);
									videoCalls.showError(title, error.reason.message);
								} else {
									if (error.code && error.code == "Canceled") {
										// Do nothing
									} else {
										var errData = getSDKErrorData(error);
										if (errData) {
											handleErrorData(callId, title, errData);
										} else {
											videoCalls.showError(title, error);
										}
									}
								}
							}
							window.removeEventListener("beforeunload", beforeunloadListener);
							window.removeEventListener("unload", unloadListener);
						};
						var handleIncoming = function() {
							var callerMessage, callerLink, callerAvatar, callerId;
							var options = {
								conversation : conversation,
								modalities : [ "Chat" ]
							};
							if (conversation.isGroupConversation()) {
								callerId = conversation.topic(); // this not true, need space/room title
								callerMessage = callerId; 
								callerLink = ""; // /portal/g/:spaces:marketing_team/marketing_team
								callerAvatar = ""; // /rest/social/identity/space/marketing_team/avatar
							} else {
								// remote participant it's who is calling to
								var caller = conversation.participants(0).person;
								callerId = caller.displayName();
								callerMessage = caller.displayName() + " is calling.";
								callerLink = ""; // /portal/intranet/profile/patrice
								callerAvatar = caller.avatarUrl(); // /rest/social/identity/organization/patrice/avatar
							}
							
							var accept = null;
							if (conversation.isGroupConversation()) {
								conversation.state.when("Conferencing", function() {
									log(">>> Conferencing incoming " + callId);
								});
								conversation.state.when("Conferenced", function() {
									log(">>> Conferenced incoming " + callId);
									window.addEventListener("beforeunload", beforeunloadListener);
									window.addEventListener("unload", unloadListener);
								});
							} else {
								conversation.state.when("Connecting", function() {
									log(">>> Connecting incoming " + callId);
									window.addEventListener("beforeunload", beforeunloadListener);
									window.addEventListener("unload", unloadListener);
								});
								conversation.state.when("Connected", function() {
									log(">>> Connected incoming " + callId);
								});
							}
							conversation.state.when("Disconnected", function() {
								log("<<< Disconnected incoming " + callId);
								accept = null;
								//app.conversationsManager.conversations.remove(conversation);
								window.removeEventListener("beforeunload", beforeunloadListener);
								window.removeEventListener("unload", unloadListener);
							});
							
							// this method may be invoked several times by the above SDK conversation's services accept callback
							// be we want ask an user once per a call, thus we will reset the worked deferred object in a seconds
							var acceptCall = function() {
								if (!accept) {
									accept = $.Deferred();
									var showCallPopover = function() {
										var popover = acceptCallPopover(callerLink, callerAvatar, callerMessage);
										popover.progress(function($call) {
											conversation.state.once("Disconnected", function() {
												if ($call.is(":visible")) {
													$call.dialog("close");
												}
											});
										}); 
										popover.done(function(msg) {
											log(">>> user " + msg + " call " + callId);
											//var callWindow = openCallWindow(callId, title ? title : provider.getTitle() + " call", tokenHash);
											if (container) {
												// switch to the call room in the Chat
												if (typeof(chatApplication) == "object" && chatApplication) {
													var $chat = $("#chat-application");
													if ($chat.length > 0) {
														var $users = $chat.find("#chat-users");
														var $rooms = $users.find(".users-online .room-link[user-data='" + callerId  + "']");
														$rooms.click();
													}
												}
												container.init();
												api.renderConversation(container.element, options).then(function(conversation) {
													container.setConversation(conversation, callerId);
													container.show();
													// TODO check this working in FF where no video/audio supported
													conversation.selfParticipant.chat.state.changed(function listener(newValue, reason, oldValue) {
														log(">>> CHAT state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																	+ " CONVERSATION state: " + conversation.state());
														if (newValue === "Notified") {
															conversation.chatService.accept().then(function() {
																log(">>> Incoming CHAT ACCEPTED");
																accept.resolve("chat");
															}, function(chatError) {
																log("<<< Error accepting chat: " + JSON.stringify(chatError));
																//handleError(chatError);
															});
														} else if (newValue === "Disconnected") {
															log("<<< CHAT disconnected for call " + callId + " CONVERSATION state: " + conversation.state());
															if (oldValue === "Connected" || oldValue === "Connecting") {
																conversation.selfParticipant.chat.state.changed.off(listener);
															}
														}
													});
													conversation.selfParticipant.audio.state.changed(function listener(newValue, reason, oldValue) {
														log(">>> AUDIO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																	+ " CONVERSATION state: " + conversation.state());
														if (newValue === "Notified") {
															conversation.audioService.accept().then(function() {
																log(">>> Incoming AUDIO ACCEPTED");
																accept.resolve("audio");
															}, function(audioError) {
																log("<<< Error accepting audio: " + JSON.stringify(audioError));
																//handleError(audioError);
															});
														} else if (newValue === "Disconnected") {
															log("<<< AUDIO disconnected for call " + callId + " CONVERSATION state: " + conversation.state());
															if (oldValue === "Connected" || oldValue === "Connecting") {
																conversation.selfParticipant.audio.state.changed.off(listener);
																if (reason && typeof(reason) === "String" && reason.indexOf("PluginUninited") >= 0) {
																	videoCalls.showError("Skype Plugin Not Initialized", 
																				"Please install <a href='https://support.skype.com/en/faq/FA12316/what-is-the-skype-web-plugin-and-how-do-i-install-it'>Skype web plugin</a> to make calls.");
																}
															}
														}
													});
													conversation.selfParticipant.video.state.changed(function listener(newValue, reason, oldValue) {
														// 'Notified' indicates that there is an incoming call
														log(">>> VIDEO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																	+ " CONVERSATION state: " + conversation.state());
														if (newValue === "Notified") {
															// TODO in case of video error, but audio or chat success - show a hint message to an user and auto-hide it
															conversation.videoService.accept().then(function() {
																log(">>> Incoming VIDEO ACCEPTED");
																accept.resolve("video");
															}, function(videoError) {
																// error starting videoService, cancel (by this user) also will go here
																log("<<< Error accepting video: " + JSON.stringify(videoError));
															});
															//window.addEventListener("beforeunload", beforeunloadListener);
															//window.addEventListener("unload", unloadListener);
														} else if (newValue === "Disconnected") {
															log("<<< VIDEO disconnected for call " + callId + " CONVERSATION state: " + conversation.state());
															if (oldValue === "Connected" || oldValue === "Connecting") {
																conversation.selfParticipant.video.state.changed.off(listener);
																if (reason && typeof(reason) === "String" && reason.indexOf("PluginUninited") >= 0) {
																	videoCalls.showError("Skype Plugin Not Initialized", 
																				"Please install <a href='https://support.skype.com/en/faq/FA12316/what-is-the-skype-web-plugin-and-how-do-i-install-it'>Skype web plugin</a> to make calls.");
																}
															}
														}
													});
												}, function(err) {
													// error rendering Conversation Control
													if (err.name && err.message) {
														log("<<< conversation rendering error: " + err.name + " " + err.message, err);
														videoCalls.showError(err.name, err.message);
													} else {
														log("<<< conversation rendering error: " + JSON.stringify(err));
													}
													container.hide();
													accept.reject("conversation error");
												});
											} else {
												accept.reject("UI container not found");
											}
										});
										popover.fail(function(err) {
											log("<<< user " + err + " call " + callId);
											accept.reject(err);
										});
										popover.always(function() {
											if (accept.state() == "pending") {
												setTimeout(function() {
													if (accept && accept.state() == "pending") {
														log(">>> accept STILL pending - null it");
														// if in 15sec no one conversation service was accepted, we reject it
														try {
															accept.reject("timeout");															
														} catch(e) {
															// was null due to below timer?
														}
													}
												}, 15000);	
											}
										});
									}
									log(">>> Get registered " + callId + " > " + new Date().getTime());
									var callInfo = videoCalls.getRegisteredCall(callId);
									callInfo.done(function(call) {
										log(">>> Got registered " + callId + " > " + new Date().getTime());
										callerId = call.owner.id;
										callerLink = call.ownerLink;
										callerAvatar = call.avatarLink;
										showCallPopover();
									});
									callInfo.fail(function(err, status) {
										log(">>> Call info error: " + JSON.stringify(err) + " (" + status + ")");
										if (typeof(status) == "number" && status == 404) {
											// Call not registered, we treat it as a call started outside Video Calls
											showCallPopover();	
										} else {
											accept.reject("call info error");
										}
									});
									accept.always(function() {
										setTimeout(function() {
											// reset it to make next incoming call able to ask an user in new popover
											accept = null;
										}, 1500);
									});
								}
								return accept.promise();
							};
							conversation.videoService.accept.enabled.when(true, function() {
								log(">> videoService ACCEPT: " + callId);
								acceptCall().fail(function(err) {
									conversation.videoService.reject();
									log("<< videoService REJECTED " + callId + ": " + err);
								});
							});
							conversation.audioService.accept.enabled.when(true, function() {
								log(">> audioService ACCEPT: " + callId);
								acceptCall().fail(function(err) {
									conversation.audioService.reject();
									log("<< audioService REJECTED " + callId + ": " + err);
								});
							});
							conversation.chatService.accept.enabled.when(true, function() {
								log(">> chatService ACCEPT: " + callId);
								// TODO chat needs specific handling
							});
							// TODO audioPhoneService accept?
						};
						if (state == "Incoming") {
							handleIncoming();
						} else if (state == "Created") {
							// Late it may become Incoming
							conversation.state.once("Incoming", function() {
								// Update call ID as it will change after first Connecting
								callId = getCallId(conversation);
								log(">>> Created > Incoming " + callId);
								handleIncoming(); 
							});
						}
					});
				}).fail(function() {
					if (container) {
						container.init();
						container.$element.append($("<div><div class='pluginError'>Please install Skype web plugin.</div></div>"));
					} // else, user aleeady notified in pnotify warning 
				});
			};
			
			var alignWindowMiniCallContainer = function($container) {
				var aw = window.screen.availWidth;
				var ah = window.screen.availHeight;
				var w, h, top, left;
				if (aw > 600) {
					w = 256;
				  h = 192;
				} else {
					w = 64;
				  h = 48;
				}
				left = (aw/2)-(w/2);
			  top = 2;
				
				$container.height(h);
				$container.width(w);
				$container.offset({
					left: left,
					top: top
				});
				//$container.find("#chatInputContainer").width("100%");
			};
			var alignChatsCallContainer = function($chats, $container) {
				var chatsPos = $chats.offset();
				$container.height($chats.height());
				$container.width($chats.width());
				$container.offset(chatsPos);
				$container.find("#chatInputContainer").width("100%");
			};
			$(window).resize(function() {
			  // align Call container to #chats div dimentions
				var $chats = $("#chat-application #chats");
				var $container = $("#mssfb-call-container");
				if ($chats.length > 0 && $container.length > 0 && $container.is(":visible")) {
					alignChatsCallContainer($chats, $container);
				}
			});
			this.init = function(context) {
				log("Init at " + location.origin + location.pathname);
				var $control = $(".mssfbControl");
				if ($control.length > 0) {
					// in user profile edit page 
					$control.click(function() {
						var $settings = $("div.uiMssfbSettings");
						if ($settings.length == 0) {
							$settings = $("<div class='uiMssfbSettings' title='" + provider.getTitle() + " settings'></div>");
							$(document.body).append($settings);
						} else {
							$settings.empty();
						}
						$settings.append($("<p><span class='ui-icon messageIcon ui-icon-gear' style='float:left; margin:12px 12px 20px 0;'></span>" +
							"<div class='messageText'>Login in to your " + provider.getTitle() + " account.</div></p>"));
						$settings.dialog({
				      resizable: false,
				      height: "auto",
				      width: 400,
				      modal: true,
				      buttons: {
				        "Login": function() {
				        	$(loginWindow()).on("unload", function() {
				        		delete provider.loginToken;
				        	});
				        	// this method will be available at eXo.videoCalls.mssfb on a call page
				        	provider.loginToken = function(token) {
										var callback = loginTokenHandler(token);
										callback.fail(function(err) {
											$settings.find(".messageIcon").removeClass("ui-icon-gear").addClass("ui-icon-alert");
											$settings.find(".messageText").html("Error! " + err);
											$settings.dialog({
												resizable: false,
									      height: "auto",
									      width: 400,
									      modal: true,
									      buttons: {
									        Ok: function() {
									        	$settings.dialog( "close" );
									        }
									      }
									    });
										});
										return callback.promise();
									}
									$settings.dialog( "close" );
				        },
				        "Cancel": function() {
				        	$settings.dialog( "close" );
				        }
				      }
				    });
					});
				} else if (typeof(chatApplication) == "object" && chatApplication) {
					// we are in the Chat, chatApplication is a global on chat app page
					var $chat = $("#chat-application");
					if ($chat.length > 0) {
						var exoUserSFB = videoCalls.imAccount(context.currentUser, "mssfb");
						if (exoUserSFB) {
							// user has SfB account, we need a call container on Chat page
							var $chats = $chat.find("#chats");
							if ($chats.length > 0) {
								var $container = $("#mssfb-call-container");
								if ($container.length == 0) {
									$container = $("<div id='mssfb-call-container' style='display: none;'></div>");
									var $closeHover = $("<a class='actionHover ' href='#' data-placement='bottom' rel='tooltip' data-original-title='Close'>" +
											"<i class='uiIconClose uiIconLightGray'></i></a>");
									$container.append($closeHover);
									$closeHover.click(function() {
										// leave conversation here
										var container = $container.data("callcontainer");
										if (container && container.getConversation()) {
											// TODO ask user for confirmation of leaving the call
											// TODO what about group convos, will user be removed from its participants also?
											var c = container.getConversation();
											var cstate = c.state();
											if (cstate == "Connecting" || cstate == "Connected" || cstate == "Conferenced") {
												c.leave();
												/* c.activeModalities.video.when(true, function() {
											    c.videoService.stop();
												});
												c.activeModalities.audio.when(true, function() {
											    c.audioService.stop();
												});
												c.activeModalities.chat.when(true, function() {
											    c.chatService.stop();
												}); */
											}
										}
										container.hide();
									});
									var chatsZ = $chats.css("z-index");
									if (typeof(chatsZ) == "Number") {
										chatsZ++;
									} else {
										chatsZ = 999;
									}
									$container.css("z-index", chatsZ);
									$(document.body).append($container);
								} else {
									$container.hide();
								}
								var container = new CallContainer($container);
								container.resized = false;
								container.onShow(function() {
									if (!container.resized) {
										container.resized = true;
										alignChatsCallContainer($chats, $container);										
									}
									$container.show();
									setTimeout(function() {
										log(">>> aligned call container in chats");
										$(window).resize();
									}, 2000);
								});
								container.onHide(function() {
									$container.hide();
								});
								$container.data("callcontainer", container);
								// try login in SfB SDK using saved token
								var initializer = $.Deferred();
								var token = currentToken();
								if (token) {
									// we reuse saved token on the Chat page
									var callback = loginTokenHandler(token);
									callback.done(function(api, app) {
										initializer.resolve(api, app);
									});
									callback.fail(function(err) {
										initializer.reject(err);
									});
								} else {
									// we need try SfB login window in hidden iframe (if user already logged in AD, then it will work)
								  loginIframe().done(function(api, app) {
								  	initializer.resolve(api, app);
								  }).fail(function(err) {
								  	initializer.reject(err);
								  });
								}
								initializer.done(function(api, app) {
									log("Automatic login done.");
									incomingCallHandler(api, app, token.hash_line, container);
								});
								initializer.fail(function(err) {
									// need login user explicitly (in a popup)
									log("Automatic login failed: " + err);
									var $roomDetail = $chat.find("#room-detail");
									var userLogin = function() {
										loginWindow();
										provider.loginToken = function(token) {
											var callback = loginTokenHandler(token);
											callback.done(function(api, app) {
												log("User login done.");
												incomingCallHandler(api, app, token.hash_line, container);
											});
											callback.fail(function(err) {
												videoCalls.showError(provider.getTitle() + " error", "Unable sign in your " + provider.getTitle() + " account. " + err);
											});
											return callback.promise();
										}
									};
									// show warn icon near the Call Button, icon with click and details popover 
									var attemtCount = 0;
									var addLoginWarn = function(wait) {
										var $wrapper = $roomDetail.find(".callButtonContainerWrapper");
										if ($wrapper.length == 0 && wait) {
											if (attemtCount < 20) {
												// wait a bit and try again
												attemtCount++;
												setTimeout(function() {
													addLoginWarn(attemtCount < 20);
												}, 250);										
											} else {
												// TODO this code never works (see wait flag above)
												var loginLinkId = "SfB_login_" + Math.floor((Math.random() * 1000) + 1);
												videoCalls.showWarn("Authorize in " + provider.getTitle(), "Please <a id='" + loginLinkId + "' href='#' class='pnotifyTextLink'>authorize</a> in your " +
														provider.getTitle() + " account to make you available.", function(pnotify) {
													$(pnotify.container).find("#" + loginLinkId).click(function() {
														userLogin();
													});
												});
											}
										} else {
											// add the link/icon with warning and login popup
											// this warning will be removed by loginTokenHandler() on done 
											$chat.find(".mssfbLoginWarningContainer").remove();
											var $loginLinkContainer = $("<div class='mssfbLoginWarningContainer parentPosition pull-left'></div>");
											var $loginLink = $("<a href='#' class='mssfbLoginWarningLink'><i class='uiIconColorWarning'></i></a>");
											$loginLinkContainer.append($loginLink);
											$chat.find(".no-user-selection .selectUserStatus+label:first").after($loginLinkContainer);
											// TODO show in room info near the call button or team dropdown
											// if ($wrapper.length > 0) {
											// $wrapper.after($loginLinkContainer);
											// } else {
											// $roomDetail.find("#chat-team-button-dropdown").after($loginLinkContainer);
											// }
											$loginLink.click(function() {
												userLogin();										
											});
											var $popoverContainer = $("<div class='gotPosition' style='position: relative; display:block'></div>");
											$popoverContainer.append("<div class='popover bottom popupOverContent' style='display: none;'>"
														+ "<span class='arrow' style='top: -8%;'></span>"
														+ "<div class='popover-content'>" + provider.getTitle() 
															+ " authorization required. Click the icon to open " + provider.getTitle() + " sign in window.</div>"
														+ "</div>");
											$loginLinkContainer.append($popoverContainer);
											var $popover = $popoverContainer.find(".popupOverContent:first");
											$loginLink.mouseover(function() {
												$popover.show("fade", 300);												
											});
											$loginLink.mouseout(function() {
												$popover.hide("fade", 300);												
											});
											$popover.show("fade", 1500);
											// hide popover in time
											setTimeout(function() {
												$popover.hide("fade", 1500);
											}, 30000);
										}
									};
									addLoginWarn(true);
								});
								// If user will click another room during the call, we move the call container to a window top
								// if user will get back to the active call room, we will resize the container to that call chats
								var $users = $chat.find("#chat-users");
								$users.find(".users-online .room-link").click(function() {
									var $roomLink = $(this);
									if ($container.is(":visible")) {
										var roomId = $roomLink.attr("user-data");
										if (roomId && container.getCallerId()) {
											if (container.isAttached()) {
												if (roomId != container.getCallerId()) {
													// move call container to the window top-center with smaller size
													log(">>> room not of the call < " + $roomLink.text());
													alignWindowMiniCallContainer($container);
													container.detached();
												} // else, do nothing
											} else {
												if (roomId == container.getCallerId()) {
													// move call container to the current room chats size
													log(">>> room of the call > " + $roomLink.text());
													alignChatsCallContainer($chats, $container);
													container.attached();
												} // else, do nothing
											}
										}
									}
								});
							} else {
								log("Cannot find #chats element for calls container");
							} 
						} // else, current user has not SfB - nothing to initialize
					}  else {
						log("Chat application element not found.");
					}
				} else if (false && window.location.pathname.startsWith("/portal/")) {
					// TODO temporarily not used logic
					// we somewhere in the portal, try login using saved token
					if (typeof(Storage) !== "undefined") {
						var savedToken = localStorage.getItem("mssfb_login_token");
						if (savedToken) {
							try {
								var token = JSON.parse(savedToken);
								var appInitializer = provider.application(loginUri, function(resource) {
									return token.token_type + " " + token.access_token;
								});
								appInitializer.done(function(api, app) {
									// TODO re-save token?
								  log("Login OK (saved), app created OK, token: " + location.hash);
								});
								appInitializer.fail(function(err) {
									log("Login (saved) error: " + JSON.stringify(err));
									localStorage.removeItem("mssfb_token_hash");
								});
							} catch(e) {
								log("Login (saved) parsing error: " + e, e);
							}
						} else {
							log("Login (saved) not possible: access token not found in local storage.");
						}
					} else {
					  // Sorry! No Web Storage support..
						log("Error reading access token: local storage not supported.");
					}
				} // else, it's also may be a call page - do we need something here?
			};
		}

		var provider = new SfBProvider();

		// Add SfB provider into videoCalls object of global eXo namespace (for non AMD uses)
		if (globalVideoCalls) {
			globalVideoCalls.mssfb = provider;
		} else {
			log("eXo.videoCalls not defined");
		}
		
		$(function() {
			try {
				// XXX workaround to load CSS until gatein-resources.xml's portlet-skin will be able to load after the Enterprise skin
				videoCalls.loadStyle("/skype/skin/mssfb.css");
				videoCalls.loadStyle("/skype/skin/mssfb-call.css");
				if (eXo.env && eXo.env.client && eXo.env.client.skin && eXo.env.client.skin == "Enterprise") {
					videoCalls.loadStyle("/skype/skin/skype-mssfb-enterprise.css");	
				}
			} catch(e) {
				log("Error loading Skype Call styles (for SfB).", e);
			}
		});

		log("< Loaded at " + location.origin + location.pathname);
		
		return provider;
	} else {
		log("WARN: videoCalls not given and eXo.videoCalls not defined. Skype provider registration skipped.");
	}
})($, typeof videoCalls != "undefined" ? videoCalls : null );
