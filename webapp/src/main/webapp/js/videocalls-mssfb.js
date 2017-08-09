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
			if (e) {
				console.log(logPrefix + msg + (typeof e == "string" ? (". Error: " + e) : JSON.stringify(e)));
				if (typeof e.stack != "undefined") {
					console.log(e.stack);
				}
			} else {
				console.log(logPrefix + msg);
			}
		}
	};
	//log("> Loading at " + location.origin + location.pathname);
	
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
			var callId = null;
			var callerId = null;
			var attached = true;
			var shown = false;
			
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
			
			var callHandlers = function(handrels) {
				for (var i=0; i<handrels.length; i++) {
					handrels[i](self.$element);
				}
			};
			
			this.init = function() {
				initElement();
				conversation = null;
				callId = null;
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
			
			this.getCallId = function() {
				return callId;
			};
			
			this.setConversation = function(convoInstance, caller, id) {
				conversation = convoInstance;
				callId = id;
				callerId = caller;
			};
			
			this.setCallId = function(id) {
				callId = id;
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
			
			this.isVisible = function() {
				return shown;
			};
			
			this.show = function() {
				callHandlers(onMssfbCallShow);
				shown = true;
				return this;
			};
			
			this.hide = function() {
				callHandlers(onMssfbCallHide);
				shown = false;
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
						isClosed = true;
						log("<< conversation leaved");
						app.conversationsManager.conversations.remove(conversation);
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
			
			var authRedirectLink = function(clientId, redirectUri, resource) {
				var loginUri = MSONLINE_LOGIN_PREFIX + "/common/oauth2/authorize?response_type=token&client_id="
					+ clientId
					+ "&redirect_uri="
					+ encodeURIComponent(redirectUri)
					+ "&resource="
					+ encodeURIComponent(resource);
				return loginUri;
			};
			
			var authRedirectWindow = function(title, clientId, redirectUri, resource) {
				var loginUri = authRedirectLink(clientId, redirectUri, resource);
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
			
			var sipId = function(mssfbId) {
				if (mssfbId && !mssfbId.startsWith("sip:")) {
					mssfbId = "sip:" + mssfbId;
				}
				return mssfbId;
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
			
			var removeLocalToken = function() {
				log("Remove login token");
				if (typeof(Storage) !== "undefined") {
			    // Code for localStorage/sessionStorage.
					localStorage.removeItem(TOKEN_STORE);
				} else {
				  // No Web Storage support.
					if (eXo && eXo.videoCalls && eXo.videoCalls.mssfb) {
						delete eXo.videoCalls.mssfb.__localToken;
					} else {
						log("WARN removing access token: local storage not supported.");
					}
				}
			};
			var saveLocalToken = function(token) {
				//log(">> saveLocalToken: " + tokenHashInfo(token.hash_line));
				log("Using new login token");
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
						localStorage.removeItem(TOKEN_STORE);
					} else {
						// else, we can use current token
						//log(">> currentToken: " + tokenHashInfo(token.hash_line));
						log("Using existing login token");
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
			
			var callUpdate = function() {
				// empty by default, may be overridden by chat, space etc.
			};
			
			var hasJoinedCall = function(callRef) {
				// may be overridden by chat, space etc.
				return false;
			};
			
			var getLocalCall = function(callRef) {
				// may be overridden by chat, space etc.
				return localConvos[callRef];
			};
			
			var saveLocalCall = function(state) {
				// may be overridden by chat, space etc.
				var prev = localConvos[state.callId];
				localConvos[state.callId] = state;
				localConvos[state.peer.id] = state;
				return prev;
			};
			
			var removeLocalCall = function(callId) {
				// may be overridden by chat, space etc.
				var state = localConvos[callId];
				if (state) {
					delete localConvos[callId];	
					delete localConvos[state.peer.id];
				}
				return state;
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
			
			this.getJoinTitle = function() {
				if (settings) {
					return settings.joinTitle;
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

			this.uiApplication = function(redirectUri, user) {
				var initializer = $.Deferred();
				if (settings) {
					if (uiApiInstance && uiAppInstance) {
						log("Use uiApp instance");
						initializer.resolve(uiApiInstance, uiAppInstance);
					} else {
						if (!user) {
							user = videoCalls.getUser();
						}
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
							//log("uiApp redirectUri='" + redirectUri + "'");
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
			
			this.newCallContainer = function($container) {
				return new CallContainer($container);
			};
			
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
			var loginTokenHandler = function(token, user) {
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
					var appInitializer = provider.uiApplication(loginUri, user);
					appInitializer.done(function(api, app) {
						// TODO save token in the server-side for late use?
					  log("Login OK, app created OK");
					  // Save the token hash in local storage for later use
					  location.hash = prevHash;
					  token.userId = app.personsAndGroupsManager.mePerson.id();
					  saveLocalToken(token);
					  process.resolve(api, app);
					  // Remove warnings if any
					  // TODO check exactly that the SfB authorized 
						$(".mssfbLoginButton").remove();
					  // And care about token renewal
						// TODO another approach to rely on the SDK calls to login page, but this doesn't work in IE
						var updateTime = (token.expires_in > 3660 ? 3600 : token.expires_in - 60)  * 1000;
						loginTokenUpdater = setTimeout(function() {
							loginTokenUpdater = null;
							loginIframe().done(function() {
								log(">>> updated login token to: " + token.created);
							}).fail(function(err) {
								log(">>> ERROR updating login token: " + err);
							});
						}, updateTime);
					});
					appInitializer.fail(function(err) {
						log("Login error: " + JSON.stringify(err));
						location.hash = prevHash;
						process.reject(err);
					});
					// it is possible that MS auth will fail silently and we will not receive any status or callback from their SDK
					// an usecase, logout from MS account, but keep saved login token in this script and try use it, as a result
					// we'll see an iframe crated by the SDK, it will contain an error about not found tenant and error 400, but error
					// callback will not be executed in the SDK signIn and the state will stay on "SigningIn".
					// Thus we'll wait a reasonable time for login and if appInitializer will stay pending - reject it.
					setTimeout(function() {
						if (appInitializer.state() == "pending") {
							location.hash = prevHash;
							// Force getting of a new token
							localStorage.removeItem(TOKEN_STORE);
							process.reject("Application timeout. Please retry.");
						}
					},30000);
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
				var iframeUri = authRedirectLink(settings.clientId, loginUri, "https://webdir.online.lync.com");
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
						var iframe = $iframe.get(0);
						var doc = (iframe.contentWindow || iframe.contentDocument);
						// if accessed ok, then it's eXo server URL, not MS login
						if (doc) {
							if (doc.document) doc = doc.document;
							var checkUri = doc.URL;
							var aci = checkUri.indexOf("#access_token");
							if (aci > 0) {
								checkUri = checkUri.substring(0, aci);
							}
							log("Login iframe check DONE: " + checkUri);							
						} else {
							throw "Document not accessible";
						}
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
						log(">> ERROR: group conversation state not 'Created' but without URI, state was: " + c.state());
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
				if (error.code == "CommandDisabled" || error.code == "AssertionFailed"
						|| (error.code == "InvitationFailed" && error.reason.subcode == "UnsupportedMediaType")
						// it's a case when group conference re-created and incoming happen, this error occurs but doesn't prevent the work
						|| (error.code == "InvalidState" && error.actual == "Connecting" && error.expected == "Notified")) {
					return true;
				}
				return false;
			};
			this.isModalityUnsupported = isModalityUnsupported;
			var handleError = function(callId, error, postOp) {
				var title = "Error starting call";
				if (error) {
					// TODO {"code":"CommandDisabled"}? 
					// {"code":"AssertionFailed"}? happens in Chrome when Video cannot be rendered
					var handled = false;
					var isError = true;
					var isOutdated = false;
					if (error.code) { 
						if (error.code == "Canceled") {
							// Do nothing
							handled = true;
							isError = false;
						} else if (error.code == "InvitationFailed" && error.reason && "DestinationNotFound" == error.reason.subcode) {
							// It's a case of outdated conference call, need re-establish it
							// {"code":"InvitationFailed","reason":{"code":"NotFound","subcode":"DestinationNotFound","message":"The person or meeting doesn't exist."}}
							handled = true;
							isError = false;
							isOutdated = true;
						}
					}
					if (!handled) {
						if (error.reason && error.reason.subcode && error.reason.message) {
							log(">>> call " + callId + " ERROR: " + error.reason.subcode + ". " + error.reason.message);
							videoCalls.showError(title, error.reason.message);
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
				if (postOp) {
					postOp(isError, isOutdated);
				}
			};
			
			var activeParticipants = function(conversation) {
				var process = $.Deferred();
				conversation.participants.get().then(function(ulist) {
					var active = [];
					//for (var i=0; cpi<conversation.participantsCount(); i++) {
					for (var i=0; i<ulist.length; i++) {
						//if (conversation.participants(i).state.get() != "Disconnected") {
						if (ulist[i].state.get() != "Disconnected") {
							active.push(ulist[i]);
						};
					}
					process.resolve(active);
				}).catch(function(err) {
					process.reject(err);
				});				
				return process.promise();
			};
			
			var canJoin = function(localCall) {
				return localCall.state == "started" || localCall.state == "canceled" || localCall.state == "leaved";
			};
			
			var outgoingCallHandler = function(api, app, container, currentUser, target, userIds, participants, localCall) {
				var process = $.Deferred();
				container.init();
				checkPlugin(app).done(function() {
					var peerId, peerType, peerRoom;
					var options = {
								modalities : [ "Chat" ]
					};
					if (localCall && localCall.conversation) {
						// it's existing conversation, it was running in this app/page
						options.conversation = localCall.conversation;
					} else {
						if (target.group) {
							var addParticipant = function(conversation, pid) {
								try {
									var remoteParty = conversation.createParticipant(pid);
									conversation.participants.add(remoteParty);
								} catch(e) {
									log(">>> Error creating group participant " + pid, e);
									// TODO notify user
								}
							};
							if (target.callId) {
								// reuse existing group convo: cut 'g/' from the call id - it's a SIP URI
								var conversation = app.conversationsManager.getConversationByUri(target.callId.substring(2));
								if (conversation) {
									log("Reuse group conversation " + target.callId + " " + conversation.state());
									options.conversation = conversation;
									// We add new parts from given participants to the existing convo
									// TODO Should we remove not existing locally?
									var remoteParts = [];
									for (var cpi=0; cpi<conversation.participantsCount(); cpi++) {
										remoteParts.push(conversation.participants(cpi).person.id());
									}
									nextLocal: for (var lpi=0; lpi<participants.length; lpi++) {
										for (var rpi=0; rpi<remoteParts.length; rpi++) {
											var lpid = participants[lpi];
											if (lpid) {
												if (lpid == remoteParts[rpi]) {
													continue nextLocal;
												}
												// add a new party
												addParticipant(conversation, lpid);
											}
										}
									}
								} else {
									log("Group conversation not found " + target.callId + " for call '" + target.title + "'");
									options.participants = participants;
								}
							} else {
								var conversation = app.conversationsManager.createConversation();
								for (var i=0; i<participants.length; i++) {
									var pid = participants[i];
									addParticipant(conversation, pid);
								}
								options.conversation = conversation;
							}
						} else {
							options.participants = participants;
						}
					}
					api.renderConversation(container.element, options).then(function(conversation) {
						var callId = getCallId(conversation);
						log("Outgoing call '" + target.title + "' " + callId);
						logConversation(conversation);
						// TODO in case of video error, but audio or chat success - show a hint message to an user and auto-hide it
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
						var ownerType, ownerId;
						if (target.group) {
							ownerType = peerType = target.type;
							ownerId = peerId = target.id;
						} else {
							ownerType = peerType = "user";
							ownerId = currentUser.id;
							peerId = userIds[1]; // first user is an owner (caller), second one is a remote party
						}
						var callStateUpdate = function(state) {
							callUpdate({
								state : state,
								callId : callId,
								peer : {
									id : peerId,
									type : peerType,
									chatRoom : videoCalls.currentChatRoom()
								},
								conversation : conversation,
								saved : localCall ? true : false
							});
						};
						var added = false;
						var addCall = function() {
							if (!added && callId != "g/adhoc") {
								log(">>> Adding " + callId + " > " + new Date().getTime());
								added = true;
								var callInfo = {
									owner : ownerId,
									ownerType : ownerType,  
									provider : provider.getType(),
									title : conversation.topic(),
									participants : userIds.join(";") // eXo user ids here
								};
								callStateUpdate("started");
								return videoCalls.addCall(callId, callInfo).done(function(call) {
									log(">>> Added " + callId + " parts:" + conversation.participantsCount() + " > " + new Date().getTime());
								}).fail(function(err) {
									registered = false;
									log(">>> ERROR adding " + callId + ": " + JSON.stringify(err));
								});
							}
						};
						var startedCall = function() {
							callStateUpdate("started");
							return videoCalls.updateCall(callId, "started").done(function(call) {
								log("<<< Started " + callId + " parts:" + conversation.participantsCount() + " > " + new Date().getTime());
							}).fail(function(err) {
								log("<<< ERROR starting " + callId + ": " + JSON.stringify(err));
							});
						};
						var deleteCall = function() {
							log(">>> Deleting " + callId + " > " + new Date().getTime());
							callStateUpdate("stopped");
							return videoCalls.deleteCall(callId).done(function() {
								log("<<< Deleted " + callId + " parts:" + conversation.participantsCount() + " > " + new Date().getTime());
							}).fail(function(err) {
								log("<<< ERROR deleting " + callId + ": " + JSON.stringify(err));
							});
						};
						var joined = false;
						var joinedGroupCall = function() {
							if (!joined) {
								joined = true;
								callStateUpdate("joined");
								videoCalls.updateUserCall(callId, "joined").fail(function(err, status) {
									log("<<< Error joining user group call: " + callId + ". " + JSON.stringify(err) + " [" + status + "]");
								});
							}
						};
						var leavedGroupCall = function() {
							joined = false; // do this sooner
							callStateUpdate("leaved");
							videoCalls.updateUserCall(callId, "leaved").fail(function(err, status) {
								log("<<< Error leaving user group call: " + callId + ". " + JSON.stringify(err) + " [" + status + "]");
							});
						};
						var started = false;
						var startingCall = function(stateName) {
							if (!started) {
								started = true;
								callId = getCallId(conversation);
								log(">>> " + stateName + " outgoing " + callId);
								container.setCallId(callId);
								process.resolve(callId, conversation);
								if (conversation.isGroupConversation()) {
									if (target.callId) {
										if (localCall && canJoin(localCall)) {
											joinedGroupCall();
										} else {
											startedCall();
										}
									} else {
										addCall();
									}
									// In group call, we want produce started/stopped status on audio/video start/stop
									/*conversation.selfParticipant.audio.state.changed(function listener(newValue, reason, oldValue) {
										log(">>> AUDIO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
													+ " CONVERSATION state: " + conversation.state());
										if (newValue === "Disconnected") {
											log("<<< AUDIO disconnected for call " + callId + " CONVERSATION state: " + conversation.state());
											if (oldValue === "Connected" || oldValue === "Connecting") {
												conversation.selfParticipant.audio.state.changed.off(listener);
												if (conversation.participantsCount() <= 0) {
													updateCall("stopped");											
												}
											}
										}
									});
									conversation.selfParticipant.video.state.changed(function listener(newValue, reason, oldValue) {
										log(">>> VIDEO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
													+ " CONVERSATION state: " + conversation.state());
										if (newValue === "Disconnected") {
											log("<<< VIDEO disconnected for call " + callId + " CONVERSATION state: " + conversation.state());
											if (oldValue === "Connected" || oldValue === "Connecting") {
												conversation.selfParticipant.video.state.changed.off(listener);
												if (conversation.participantsCount() <= 0) {
													updateCall("stopped");											
												}
											}
										}
									});*/
								} // P2P call will be saved before the start, see below
								conversation.state.once("Disconnected", function() {
									log("<<< Disconnected outgoing " + callId);
									if (conversation.isGroupConversation()) {
										leavedGroupCall();
										/*activeParticipants(conversation).done(function(list) {
											if (list.length <= 0) {
												updateCall("stopped");
												log("<<< Stopped outgoing conference " + callId);
											} else  {
												log("<<< Still active outgoing conference " + callId + " parts: " + list.length);
											}
										});*/
										/*conversation.participantsCount.get().then(function(res) {
											if (res <= 0) {
												updateCall("stopped");
												log("<<< Stopped outgoing conference " + callId);
											} else  {
												log("<<< Still running outgoing conference " + callId + " parts: " + res);
											}
										});*/
									} else {
										deleteCall();
									}
									window.removeEventListener("beforeunload", beforeunloadListener);
									window.removeEventListener("unload", unloadListener);
									//container.hide();
									if (process.state() == "pending") {
										process.reject("disconnected");
									}
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
						if (!localCall) {
							conversation.participants.added(function(part) {
								log(">>> Participant added " + part.person.displayName() + "(" + part.person.id() + ") to " + callId);
							});
						}
						container.setConversation(conversation, callId, target.id);
						container.show();
						//process.notify(callId, conversation); // inform call is starting to the invoker code
						if (conversation.isGroupConversation()) {
							// FYI This doesn't work for group calls, at this stage a newly created convo will not have an URI, 
							// thus the call ID will be like g/adhoc, not what other parts will see in added one
							/*conversation.state.once("Conferencing", function() {
								startingCall("Conferencing");
							});*/							
							/* At this state the convo ID will be adhoc, need do on conversation service start
							 conversation.state.once("Conferenced", function() {
								startingCall("Conferenced");
							});*/
							/*conversation.participants.added(function(person) {
						    // Another participant has accepted an invitation and joined the conversation
								log(">>> Added participant to outgoing Conference " + callId + " " + JSON.stringify(person));
							});*/
						} else {
							// XXX For P2P, save in eXo sooner, to let this info be ready when the convo will be fired as 'added' at the other side
							//startingCall(conversation.state());
							addCall();
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
								handleError(callId, error, function(isError, isOutdated) {
									// For a case when Disconnected will not happen
									window.removeEventListener("beforeunload", beforeunloadListener);
									window.removeEventListener("unload", unloadListener);
									if (isOutdated) {
										app.conversationsManager.conversations.remove(conversation);
										// delete this call records in eXo service
										target.callId = null;
										deleteCall().always(function() {
											// Wait a bit for things completion
											setTimeout(function() {
												outgoingCallHandler(api, app, container, currentUser, target, userIds, participants, null).done(function(callId, newConvo) {
													process.resolve(callId, newConvo);
												}).fail(function(err) {
													process.reject(err);
												});											
											}, 250);
										});
									} else {
										if (process.state() == "pending") {
											process.reject(isError ? error : "canceled");
										}
										if (conversation.isGroupConversation()) {
											leavedGroupCall();
										} else {
											deleteCall();
										}
									}
								});
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
											// we deal with original error
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
			this.startOutgoingCall = function(api, app, container, details, localCall) {
				var currentUser = videoCalls.getUser();
				return outgoingCallHandler(api, app, container, currentUser, details.target, details.users, details.participants, localCall);
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
			
			var stopCallPopover = function(title, message) {
				log(">> stopCallPopover '" + title + "' message:" + message);
				var process = $.Deferred();
				var $call = $("div.uiStopCall");
				if ($call.length > 0) {
					try {
						$call.dialog("destroy");
					} catch(e) {
						log(">>> stopCallPopover: error destroing prev dialog ", e);
					}
					$call.remove();
				}
				$call = $("<div class='uiStopCall' title='" + title + " call'></div>");
				$call.append($("<p><span class='ui-icon warningIcon' style='float:left; margin:12px 12px 20px 0;'></span>"
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
			
			var showWrongUsers = function(wrongUsers, callWindow) {
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
			
			var targetDetails = function(currentUserSip, target) {
				var participants = []; // for embedded call
				//var ims = []; // for call on a new page
				var users = [];
				var wrongUsers = [];
				var addParticipant = function(user) {
					//var uskype = videoCalls.imAccount(u, "skype");
					var ubusiness = videoCalls.imAccount(user, "mssfb");
					if (ubusiness) {
						if (EMAIL_PATTERN.test(ubusiness.id)) {
							if (ubusiness.id != currentUserSip) {
								participants.push(ubusiness.id);
								//ims.push(encodeURIComponent(ubusiness.id));
							}
							users.push(user.id);
						} else {
							wrongUsers.push(ubusiness);
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
					users.push(videoCalls.getUser().id);
					addParticipant(target);
				}
				return { 
					target : target, 
					users : users,
					wrongUsers : wrongUsers, 
					participants : participants
				}
			};
			this.readTargetDetails = targetDetails;
			
			this.callButton = function(context) {
				var button = $.Deferred();
				if (settings && context && context.currentUser) {
					// TODO temporarily we don't support calling regular Skype users
					//context.currentUserSkype = videoCalls.imAccount(context.currentUser, "skype");
					var currentUserSFB = videoCalls.imAccount(context.currentUser, "mssfb");
					if (currentUserSFB) {
						context.currentUserSFB = currentUserSFB;
						var fullTitle = self.getTitle() + " " + self.getCallTitle();
						var targetId = context.roomId ? context.roomId : (context.spaceId ? context.spaceId : (context.userId ? context.userId : null));
						var localCall = getLocalCall(targetId);
						var title = localCall && canJoin(localCall) ? self.getJoinTitle() : self.getCallTitle();
						var disabledClass = hasJoinedCall(targetId) ? "callDisabled" : "";
						var $button = $("<a title='" + fullTitle + "' href='javascript:void(0);' class='mssfbCallAction " + disabledClass
									+ "'>"
									+ "<i class='uiIconMssfbCall uiIconForum uiIconLightGray'></i>"
									+ "<span class='callTitle'>" + title + "</span></a>");
						setTimeout(function() {
							if (!$button.hasClass("btn")) {
								// in dropdown show longer description
								$button.find(".callTitle").text(fullTitle);
							}
						}, 1000);
						$button.click(function() {
							if (!hasJoinedCall(targetId)) {
								var callDetails = function(callback) {
									context.details().done(function(target) {
										var details = targetDetails(currentUserSFB.id, target);
										if (details.participants.length > 0) {
											callback(context.currentUser, details.target, details.users, details.wrongUsers, details.participants);
										} else {
											videoCalls.showWarn("Cannot start a call", "No " + self.getTitle() + " users found.");
										}
									}).fail(function(err) {
										videoCalls.showWarn("Error starting a call", err.message);
									});
								};
								var token = currentToken();
								var container = $("#mssfb-call-container").data("callcontainer");
								if (container) {
									// Call will run inside current page
									// We need SDK API/app instance - try reuse saved locally SfB token
									var embeddedCall = function(api, app) {
										callDetails(function(currentUser, target, users, wrongUsers, participants) {
											if (participants.length > 0) {
												var localCall;
												if (target.callId) {
													localCall = getLocalCall(target.callId);
												}
												if (container.isVisible()) {
													var currentConvo = container.getConversation();
													var message = "Do you want " 
															+ (currentConvo.isGroupConversation() ? "leave '" + currentConvo.topic() + "' call" : "stop call with " + currentConvo.participants(0).person.displayName())
															+ " and start " 
															+ (target.group ? "'" + target.title + "' call" : " call to " + target.title) + "?";
													stopCallPopover("Start a new " + provider.getTitle() + " call&#63;", message).done(function() {
														container.getConversation().leave().then(function() {
															log("<<< Current conversation leaved " + container.getCallId() + " for " + (localCall ? "saved" : "new") + " outgoing");
														});
														outgoingCallHandler(api, app, container, currentUser, target, users, participants, localCall);
														showWrongUsers(wrongUsers);
													}).fail(function() {
														log("User don't want stop existing call and call to " + target.title);
													});
												} else {
													outgoingCallHandler(api, app, container, currentUser, target, users, participants, localCall);
													showWrongUsers(wrongUsers);													
												}
											} else {
												videoCalls.showWarn("Cannot start a call", "No " + self.getTitle() + " users found.");
											}										
										});
									};
									if (token && uiApiInstance && uiAppInstance) {
										log("Automatic login done.");
										embeddedCall(uiApiInstance, uiAppInstance);
									} else {
										// we need try SfB login window in hidden iframe (if user already logged in AD, then it will work)
										// FYI this iframe will fail due to 'X-Frame-Options' to 'deny' set by MS
										// TODO may be another URL found to do this? - see incoming call handler for code
										// need login user explicitly (in a popup)
										log("Automatic login failed: login token not found or expired");
										var login = loginWindow();
										provider.loginToken = function(token) {
											var callback = loginTokenHandler(token);
											callback.done(function(api, app) {
												log("User login done.");
												//makeCallPopover("Make " + provider.getTitle() + " call?", "Do you want make a call?").done(function() {
												embeddedCall(api, app);
												//}).fail(function() {
												//	log("User don't want make a call to " 
												//				+ (context.roomId ? context.roomTitle : (context.spaceId ? context.spaceId : (context.userId ? context.userId : ""))));
												//});
											});
											callback.fail(function(err) {
												videoCalls.showError(provider.getTitle() + " error", "Unable sign in your " + provider.getTitle() + " account. " + err);
											});
											return callback.promise();
										};
										if (!login) {
											log("ERROR: User login failed due to blocked popup");
										}
									}
								} else {
									// Call will run in a new page using call ID and call title,
									// Call ID format here: 'target_type'/'target_id', the call page will request the target details in REST service
									var callId;
									if (context.userId) {
										callId = "user/" + context.userId;
									} else if (context.spaceId) {
										callId = "space/" + context.spaceId;
									} else if (context.roomName && context.roomId) {
										callId = "chat_room/" + context.roomName + "/" + context.roomId;
									} else {
										log("ERROR: Unsupported call context " + context);
									}
									if (callId) {
										var callWindow = openCallWindow(callId, fullTitle);
										callWindow.document.title = fullTitle + "...";
									}
								}								
							}
						});
						button.resolve($button);
					} else {
						button.reject("Not SfB user");
					}
				} else {
					button.reject("Not configured or empty context for " + self.getTitle());
				}
				return button.promise();
			};
				
			var acceptCallPopover = function(callerLink, callerAvatar, callerMessage, withRing) {
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
					  	$call.dialog("close");
					  },
					  "Decline": function() {
					  	process.reject("declined");
					  	$call.dialog("close");
					  }
					} 
				});
				$call.on("dialogclose", function( event, ui ) {
					if (process.state() == "pending") {
						process.reject("closed");
					}
				});
				process.notify($call);
				if (withRing) { 
					var $ring = $("<audio controls loop style='display: none;'>"
								+ "<source src='https://latest-swx.cdn.skype.com/assets/v/0.0.300/audio/m4a/call-outgoing-p1.m4a' type='audio/mpeg'>"  
								+ "Your browser does not support the audio element.</audio>");
					$(document.body).append($ring);
					var player = $ring.get(0);
					player.pause();
					//player.currentTime = 0;
					setTimeout(function () {      
						player.play();
					}, 250);
					process.always(function() {
						player.pause();
						$ring.remove();
					});
				}
				return process.promise();
			};
			
			var incomingCallHandler = function(api, app, container) {
				var $callPopup;
				var handled = {};
				// This function handles a single conversation object, added in SDK or notified via eXo user update
				var handleIncoming = function(conversation, saved) {
					var callId = getCallId(conversation);
					log(conversation.state() + " call: " + callId);
					var accept;
					var callerMessage, callerLink, callerAvatar, callerId, callerType, callerRoom;
					var callStateUpdate = function(state, modality, error) {
						var res = { 
							state :  state,
							saved : saved,
							callId : callId,
							peer : {
								id : callerId,
								type : callerType,
								chatRoom : callerRoom
							},
							conversation : conversation
						};
						if (modality) {
							res.modality = modality;
						}
						if (error) {
							res.error = error;
						}
						callUpdate(res);
					};
					// As conversation may be notified several times via eXo user update, we want set its listeners
					// only once (to avoid multiplication of events)
					// TODO callId may change in case of escalation P2P to group call
					if (!handled[callId]) {
						handled[callId] = true;
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
						var joined = false;
						var joinedGroupCall = function() {
							if (!joined) {
								joined = true;
								videoCalls.updateUserCall(callId, "joined").fail(function(err, status) {
									log("<<< Error joining user group call: " + callId + ". " + JSON.stringify(err) + " [" + status + "]");
								});
							}
						};
						var leavedGroupCall = function() {
							joined = false; // do this sooner
							videoCalls.updateUserCall(callId, "leaved").fail(function(err, status) {
								log("<<< Error leaving user group call: " + callId + ". " + JSON.stringify(err) + " [" + status + "]");
							});
						};
						// TODO add events after the start/join
						if (conversation.isGroupConversation()) {
							conversation.state.when("Conferencing", function() {
								log(">>> Conferencing incoming " + callId);
							});
							conversation.state.when("Conferenced", function() {
								log(">>> Conferenced incoming " + callId + " parts: " + conversation.participantsCount());
								window.addEventListener("beforeunload", beforeunloadListener);
								window.addEventListener("unload", unloadListener);
							});
							/*conversation.participants.added(function(person) {
						    // Another participant has accepted an invitation and joined the conversation
								log(">>> Added participant to incoming Conference " + callId + " " + JSON.stringify(person));
							});*/
						} else {
							conversation.state.when("Connecting", function() {
								log(">>> Connecting incoming " + callId);
								window.addEventListener("beforeunload", beforeunloadListener);
								window.addEventListener("unload", unloadListener);
							});
							conversation.state.when("Connected", function() {
								log(">>> Connected incoming " + callId);
							});
							// If person added and it was a P2P, we have call escalation to a conference, need update callId
							// This will happen if add user inside the SfB call UI, an external user etc.
							conversation.participants.added(function(part) {
								//var oldCallId = callId;
								var callId = getCallId(conversation);
								log(">>> Participant added " + part.person.id() + " to " + callId);
							});
						}
						conversation.state.when("Disconnected", function() {
							log("<<< Disconnected incoming " + callId);
							//accept = null; // TODO - see always/timeout below. Release the acceptor for a next call within this convo
							if (conversation.isGroupConversation()) {
								callStateUpdate("leaved");
								leavedGroupCall();
								/*activeParticipants(conversation).done(function(list) {
									if (list.length <= 0) {
										videoCalls.updateCall(callId, "stopped").done(function(call) {
											log("<<< Stopped incoming conference " + callId);
										}).fail(function(err) {
											log("<<< ERROR updating to stopped " + callId + ": " + JSON.stringify(err));
										});
									} else  {
										log("<<< Still active incoming conference " + callId + " parts: " + list.length);
									}
								});*/
								/*conversation.participantsCount.get().then(function(res) {
									if (res <= 0) {
										videoCalls.updateCall(callId, "stopped").done(function(call) {
											log("<<< Stopped " + callId + " parts:" + conversation.participantsCount() + " > " + new Date().getTime());
										}).fail(function(err) {
											log("<<< ERROR updating to stopped " + callId + ": " + JSON.stringify(err));
										});
									}
								});*/
							} else {
								callStateUpdate("stopped");
							}
							window.removeEventListener("beforeunload", beforeunloadListener);
							window.removeEventListener("unload", unloadListener);
						});
					}
					
					// This method may be invoked several times by the above SDK conversation's services accept callback
					// be we want ask an user once per a call, thus we will reset this deferred in seconds.
					// The 'accept' variable used by single (!) conversation, but acceptCall() can be invoked several times
					// by eXo user update event
					var acceptCall = function() {
						if (!accept) {
							accept = $.Deferred();
							accept.always(function() {
								// wait a bit for latency of video/audio notification in Skype SDK and release it for next attempts
								setTimeout(function() {
									accept = null;
								}, 2500);
							});
							var showCallPopover = function() {
								if (container.isVisible()) {
									callerMessage += " Your current call will be stopped if you answer this call.";
								}
								var popover = acceptCallPopover(callerLink, callerAvatar, callerMessage, /*saved &&*/ conversation.isGroupConversation());
								popover.progress(function($call) {
									$callPopup = $call;
									$callPopup.callId = callId;
									conversation.state.changed(function listener(newValue, reason, oldValue) {
										// convo may be already in Disconnected state for saved calls
										if (newValue === "Disconnected" && (oldValue === "Incoming" || oldValue === "Connected" || oldValue === "Connecting" || oldValue === "Conferencing" || oldValue === "Conferenced")) {
											conversation.state.changed.off(listener);
											if ($call.is(":visible")) {
												$call.dialog("close");
											}
										}
									});
								}); 
								popover.done(function(msg) {
									log(">>> user " + msg + " call " + callId);
									if (container) {
										// TODO support several calls at the same time
										// If call container already running a conversation, we leave it and start this one 
										if (container.isVisible()) { // && callId != container.getCallId()
											container.getConversation().leave().then(function() {
												log("<<< Current conversation leaved " + container.getCallId() + " for accepted incoming");
											});
										}
										callStateUpdate("accepted");
										container.init();
										var options = {
											conversation : conversation,
											modalities : [ "Chat" ]
										};
										api.renderConversation(container.element, options).then(function(conversation) {
											container.setConversation(conversation, callId, callerId);
											container.show();
											if (saved && conversation.isGroupConversation()) { // was saved
												// This should work for saved (reused) group conference calls, 
												// P2P and new incoming conference will not work this way
												// TODO two state.changed below for debug info only
												conversation.selfParticipant.audio.state.changed(function listener(newValue, reason, oldValue) {
													log(">>> AUDIO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																+ " CONVERSATION state: " + conversation.state());
													/*if (newValue === "Disconnected") {
														log("<<< AUDIO disconnected for call " + callId + " CONVERSATION state: " + conversation.state());
														if (oldValue === "Connected" || oldValue === "Connecting") {
															conversation.selfParticipant.audio.state.changed.off(listener);
															if (conversation.participantsCount() <= 0) {
																updateCall("stopped");											
															}
														}
													}*/
												});
												conversation.selfParticipant.video.state.changed(function listener(newValue, reason, oldValue) {
													log(">>> VIDEO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																+ " CONVERSATION state: " + conversation.state());
													/*if (newValue === "Disconnected") {
														log("<<< VIDEO disconnected for call " + callId + " CONVERSATION state: " + conversation.state());
														if (oldValue === "Connected" || oldValue === "Connecting") {
															conversation.selfParticipant.video.state.changed.off(listener);
															if (conversation.participantsCount() <= 0) {
																updateCall("stopped");											
															}
														}
													}*/
												});
												// When conversation was accepted previously, we just start modality on it
												conversation.videoService.start().then(function() {
													log(">>> Incoming (saved) VIDEO STARTED");
													accept.resolve("video");
												}, function(videoError) {
													// error starting videoService, cancel (by this user) also will go here
													log("<<< Error starting incoming (saved) VIDEO: " + JSON.stringify(videoError));
													if (isModalityUnsupported(videoError)) {
														// ok, try audio
														conversation.audioService.start().then(function() {
															log(">>> Incoming (saved) AUDIO STARTED");
															accept.resolve("audio");
														}, function(audioError) {
															log("<<< Error starting incoming (saved) AUDIO: " + JSON.stringify(audioError));
															if (isModalityUnsupported(audioError)) {
																// well, it will be chat (it should work everywhere)
																conversation.chatService.start().then(function() {
																	log(">>> Incoming (saved) CHAT STARTED ");
																	accept.resolve("chat");
																}, function(chatError) {
																	log("<<< Error starting incoming (saved) CHAT: " + JSON.stringify(chatError));
																	// we deal with original error
																	accept.reject(videoError);
																});
															} else {
																accept.reject(videoError);
															}
														});
													} else {
														accept.reject(videoError);
													}
												});
											} else {
												// TODO check this working in FF where no video/audio supported
												conversation.selfParticipant.video.state.changed(function listener(newValue, reason, oldValue) {
													// 'Notified' indicates that there is an incoming call
													log(">>> VIDEO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																+ " CONVERSATION state: " + conversation.state());
													if (newValue === "Notified") {
														// TODO in case of video error, but audio or chat success - show a hint message to an user and auto-hide it
														log(">>> Incoming VIDEO ACCEPTING Notified");
														conversation.videoService.accept().then(function() {
															log(">>> Incoming VIDEO ACCEPTED");
															accept.resolve("video");
														}, function(videoError) {
															// error starting videoService, cancel (by this user) also will go here
															log("<<< Error accepting video: " + JSON.stringify(videoError));
															if (!isModalityUnsupported(videoError)) {
																accept.reject(videoError);
															}
														});
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
												conversation.selfParticipant.audio.state.changed(function listener(newValue, reason, oldValue) {
													log(">>> AUDIO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																+ " CONVERSATION state: " + conversation.state());
													if (newValue === "Notified") {
														log(">>> Incoming AUDIO ACCEPTING Notified");
														conversation.audioService.accept().then(function() {
															log(">>> Incoming AUDIO ACCEPTED");
															accept.resolve("audio");
														}, function(audioError) {
															log("<<< Error accepting audio: " + JSON.stringify(audioError));
															if (!isModalityUnsupported(audioError)) {
																accept.reject(audioError);
															}
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
												conversation.selfParticipant.chat.state.changed(function listener(newValue, reason, oldValue) {
													log(">>> CHAT state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																+ " CONVERSATION state: " + conversation.state());
													if (newValue === "Notified") {
														conversation.chatService.accept().then(function() {
															log(">>> Incoming CHAT ACCEPTED");
															accept.resolve("chat");
														}, function(chatError) {
															log("<<< Error accepting chat: " + JSON.stringify(chatError));
															if (!isModalityUnsupported(chatError)) {
																accept.reject(chatError);
															}
														});
													} else if (newValue === "Disconnected") {
														log("<<< CHAT disconnected for call " + callId + " CONVERSATION state: " + conversation.state());
														if (oldValue === "Connected" || oldValue === "Connecting") {
															conversation.selfParticipant.chat.state.changed.off(listener);
														}
													}
												});
											}
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
									if (accept && accept.state() == "pending") {
										var thisAccept = accept;
										setTimeout(function() {
											if (thisAccept.state() == "pending") {
												log(">>> accept STILL pending - reject it");
												// if in 15sec no one conversation service was accepted, we reject it
												try {
													thisAccept.reject("timeout");															
												} catch(e) {
													// was null due to below timer?
												}
											}
										}, 15000);	
									}
								});
							};
							if (hasJoinedCall(callId)) { // container.isVisible() && callId == container.getCallId()
								// User already running this call (this may happen if remote initiator leaved and joined again)
								accept.resolve();
							} else {
								//log(">>> Get registered " + callId + " > " + new Date().getTime());
								videoCalls.getCall(callId).done(function(call) {
									log(">>> Got registered " + callId + " > " + new Date().getTime());
									callerId = call.owner.id;
									callerLink = call.ownerLink;
									callerAvatar = call.avatarLink;
									callerType = call.owner.type;
									if (call.owner.group) {
										callerMessage = call.title + " conference call.";
									} // otherwise, we already have a right message (see above)
									if (callerType == "space") {
										// Find room ID for space calls in Chat
										videoCalls.spaceChatRoom(callerId).done(function(roomId) {
											callerRoom = roomId;
											callStateUpdate("incoming");
										}).fail(function(err, status) {
											log("Error requesting Chat's getRoom() [" + status + "] ", error);
										});
									} else {
										// we assume: else if (callerType == "chat_room" || callerType == "user") 
										callerRoom = callerId;
										callStateUpdate("incoming");
									}
									showCallPopover();
								}).fail(function(err, status) {
									log(">>> Call info error: " + JSON.stringify(err) + " (" + status + ")");
									if (typeof(status) == "number" && status == 404) {
										// Call not registered, we treat it as a call started outside Video Calls
										showCallPopover();	
									} else {
										accept.reject("call info error");
									}
								});								
							}
							accept.done(function(modality) {
								if (conversation.isGroupConversation()) {
									callStateUpdate("joined", modality);
									joinedGroupCall();
								} else {
									callStateUpdate("started", modality);									
								}
							});
							accept.fail(function(err) {
								if (err == "declined" || err == "closed" || err == "timeout") {
									callStateUpdate("canceled");
								} else if (err == "closed") {
									// TODO User closed the accept popup: not accepted not declined, was not on place? 
									// We don't update the state at all, is it correct?
								} else {
									callStateUpdate("error", null, err);
								}
							});
						}
						return accept.promise();
					};
					
					// TODO rework the logic to handle added and saved differently: add convo listeners for saved once only
					if (saved) {
						acceptCall();
					} else {
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
					}
				};
				checkPlugin(app).done(function() {
					// We want handle both "Incoming" added by remote part and "Created" added here as outgoing and later re-used as "Incoming"
					app.conversationsManager.conversations.removed(function(conversation, key, index) {
						var callId = getCallId(conversation);
						removeLocalCall(callId);
						delete handled[callId];
						delete logging[key];
					});
					app.conversationsManager.conversations.added(function(conversation, key, index) {
						var state = conversation.state();
						log(">>> " + state + " (added) " + getCallId(conversation));
						logConversation(conversation, key, index);
						if (state == "Incoming") {
							handleIncoming(conversation);
						} else if (state == "Created") {
							// Late it may become Incoming
							conversation.state.once("Incoming", function() {
								// Update call ID as it will change after first Connecting
								var callId = getCallId(conversation);
								if (!hasJoinedCall(callId)) { //  (container.isVisible() && callId != container.getCallId())
									log(">>> Created (added) > Incoming " + callId);
									setTimeout(function() {
										// We let some time to Incoming listener below in user updates polling
										var localCall = getLocalCall(callId);
										handleIncoming(conversation, localCall ? localCall.saved : false);										
									}, 250);
								} else {
									log(">>> Created (added) < Incoming already handled " + callId);
								}
							});
						}
					});
					// We also handle re-established group conferences (while it is not outdated by Skype services)
					videoCalls.getUserGroupCalls().done(function(list) {
						//if (list && list.length > 0) {
							var callStarted = function(callId, peer) {
								callUpdate({
									state : "started",
									callId : callId,
									peer : peer,
									saved : true
								});
							};
							for (var i=0; i<list.length; i++) {
								var callState = list[i];
								if (callState.state == "started") {
									// Mark it started in Chat
									videoCalls.getCall(callState.id).done(function(call) {
										if (call.owner.type == "space") {
											// Find room ID for space calls in Chat
											videoCalls.spaceChatRoom(call.owner.id).done(function(roomId) {
												callStarted(call.id, {
													id : call.owner.id,
													type : call.owner.type,
													chatRoom : roomId
												});
											}).fail(function(err, status) {
												log("Error requesting Chat's getRoom() [" + status + "] ", error);
											});
										} else {
											// we assume: else if (callerType == "chat_room" || callerType == "user") 
											callStarted(call.id, {
												id : call.owner.id,
												type : call.owner.type,
												chatRoom : call.owner.id
											});
										}
									}).fail(function(err, status) {
										log(">>> Call info error: " + JSON.stringify(err) + " (" + status + ")");
									});
								}
							}
							log(">>> User has registered group calls - start long polling for these calls updates " + JSON.stringify(list));
							(function poll(prevData, prevStatus) {
								var timeout = prevStatus == 0 ? 60000 : (prevStatus >= 400 ? 15000 : 250);
								setTimeout(function() {
									var userId = videoCalls.getUser().id;
									videoCalls.pollUserUpdates(userId).done(function(update, status) {
										if (update.eventType == "call_state") {
											log(">>> User call state updated: " + JSON.stringify(update) + " [" + status + "]");
											if (update.callState == "started") {
												var conversation = app.conversationsManager.getConversationByUri(update.callId.substring(2));
												if (conversation) {
													logConversation(conversation);
													var state = conversation.state();
													// Created - for restored saved, Conferenced - not happens, but if will, it has the same meaning
													// Disconnected - for previously conferenced on this page
													if (state == "Disconnected" || state == "Conferenced") {
														log(">>>> Incoming (saved) existing " + update.callId);
														handleIncoming(conversation, true);
													} else if (state == "Created") {
														log(">>>> Incoming (saved) created " + update.callId);
														// Created (from above getConversationByUri()) may quickly become Incoming by SDK logic for new group calls,
														// thus let the SDK work and if not yet incoming, proceed with it
														var handle = setTimeout(function() {
															var local = getLocalCall(update.callId); 
															if (!local) {
																handleIncoming(conversation, true);
															}
														}, 5000);
														conversation.state.once("Incoming", function() {
															// This lister should work before Incoming handled in added handler above
															// if it become Incoming - cancel the delayed handler, it will be worked in 'added' logic above
															clearTimeout(handle);
															// Also save it as 'leaved' (!), later after handleIncoming() it will become 'incoming' 
															// and then will be handled properly
															// TODO this finally caused error of accepting new incoming group call
															// [mssfb_915] <<< Error starting incoming (saved) VIDEO: {"code":"CommandDisabled"}
															// but video state was: undefined->Notified
															/*saveLocalCall({
																state : "leaved",
																callId : update.callId,
																peer : {
																	id : update.caller.id,
																	type : update.caller.type,
																	chatRoom : update.caller.id // room should not be used for this state
																},
																conversation : conversation, 
																saved : true
															});*/
														});
													} else if (state == "Incoming") {
														log("<<<< User call " + update.callId + " state Incoming skipped, will be handled in added listener");
													} else {
														log("<<<< User call " + update.callId + " not active (" + state + ")");
													}
												} else {
													log("<<<< User call " + update.callId + " not found in conversation manager");
												}
											} else if (update.callState == "stopped") {
												// Hide accept popover for this call
												if ($callPopup && update.callId == $callPopup.callId) {
													if ($callPopup.is(":visible")) {
														$callPopup.dialog("close");
													}
												}
												var localCall = getLocalCall(update.callId);
												if (localCall && canJoin(localCall) && localCall.conversation) {
													// We leave if something running
													localCall.conversation.leave().then(function() {
														log("<<< Current conversation stopped and leaved " + container.getCallId());
													});
												}
												var callStopped = function(callerRoom) {
													callUpdate({
														state : "stopped",
														callId : update.callId,
														peer : {
															id : update.caller.id,
															type : update.caller.type,
															chatRoom : callerRoom
														},
														saved : true
													});
												};
												if (update.caller.type == "space") {
													// Find room ID for space calls in Chat
													videoCalls.spaceChatRoom(update.caller.id).done(function(roomId) {
														callStopped(roomId);
													}).fail(function(err, status) {
														log("Error requesting Chat's getRoom() [" + status + "] ", error);
													});
												} else {
													// we assume: else if (callerType == "chat_room" || callerType == "user") 
													callStopped(update.caller.id);
												}
											}
										} else if (update.eventType == "call_joined") {
											// TODO what is here?
										} else if (update.eventType == "call_leaved") {
											// TODO what is here?
										} else if (update.eventType == "retry") {
											log("<<< Retry for user updates [" + status + "]");
										} else {
											log("<<< Unexpected user update: " + JSON.stringify(update) + " [" + status + "]");
										}
									}).fail(function(data, status, err) {
										log("<<< User update error: " + JSON.stringify(data) + " [" + status + "] " + err);
									}).always(poll);
							  }, timeout);
							})();
						//}
					}).fail(function(err, status) {
						log("<<< Error getting user group calls: " + JSON.stringify(err) + " [" + status + "]");
					});
				}).fail(function() {
					if (container) {
						container.init();
						container.$element.append($("<div><div class='pluginError'>Please install Skype web plugin.</div></div>"));
					} // else, user already notified in pnotify warning
				});
			};
			
			var alignWindowMiniCallContainer = function($container) {
				var aw = $(document).width();
				var ah = $(document).height();
				var w, h, top, left;
				if (aw > 760) {
					w = 340;
				  h = 180;
				} else if (aw > 360) {
					w = 164;
				  h = 82;
				} else {
					w = 96;
				  h = 48;
				}
				left = (aw/2)-(w/2);
			  top = 0;
				
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
				var container = $container.data("callcontainer");
				if ($chats.length > 0 && $container.length > 0 && $container.is(":visible")) {
					if (container.isAttached()) {
						alignChatsCallContainer($chats, $container);
					} else {
						alignWindowMiniCallContainer($container);
					}
				}
			});
			
			var showSettingsLogin = function(mssfbId) {
				var process = $.Deferred();
				var $settings = $("div.uiMssfbSettings");
				$settings.remove();
				$settings = $("<div class='uiMssfbSettings' title='" + provider.getTitle() + " settings'></div>");
				$(document.body).append($settings);
				$settings.append($("<p><span class='ui-icon messageIcon ui-icon-gear' style='float:left; margin:12px 12px 20px 0;'></span>" +
					"<div class='messageText'>Login in to your " + provider.getTitle() + " account.</div></p>"));
				$settings.dialog({
				  resizable: false,
				  height: "auto",
				  width: 400,
				  modal: true,
				  buttons: {
						"Login": function() {
							loginWindow();
							// this method will be available at eXo.videoCalls.mssfb on a call page
							provider.loginToken = function(token) {
								var user;
								if (mssfbId) {
									user = videoCalls.getUser();
									var exoUserSFB = videoCalls.imAccount(user, "mssfb");
						  		if (exoUserSFB) {
						  			exoUserSFB.id = mssfbId;
						  		}		        			
								}
								var callback = loginTokenHandler(token, user);
								callback.done(function() {
									process.resolve();
								}); 
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
									process.reject(err);
								});
								callback.always(function() {
									$settings.dialog( "close" );									
								});
								return callback.promise();
							};
						},
						"Cancel": function() {
							process.reject();
							$settings.dialog( "close" );
						}
				  }
				});
				$settings.on("dialogclose", function( event, ui ) {
					if (process.state() == "pending") {
						process.reject("closed");
					}
				});
				return process.promise();
			};
			
			var showSettingsLogout = function() {
				var process = $.Deferred();
				var $settings = $("div.uiMssfbSettings");
				$settings.remove();
				$settings = $("<div class='uiMssfbSettings' title='" + provider.getTitle() + " settings'></div>");
				$(document.body).append($settings);
				$settings.append($("<p><span class='ui-icon messageIcon ui-icon-gear' style='float:left; margin:12px 12px 20px 0;'></span>" +
					"<div class='messageText'>Forget your " + provider.getTitle() 
					+ " access token. A new token can be aquired later by doing login in user profile or by making an outgoing call.</div></p>"));
				$settings.dialog({
					resizable: false,
					height: "auto",
					width: 400,
					modal: true,
					buttons: {
					  "Logout": function() {
					  	removeLocalToken();
					  	process.resolve();
							$settings.dialog( "close" );
					  },
					  "Cancel": function() {
					  	process.reject();
					  	$settings.dialog( "close" );
					  }
					}
				});
				$settings.on("dialogclose", function( event, ui ) {
					if (process.state() == "pending") {
						process.reject("closed");
					}
				});
				return process.promise();
			};
			
			var createLoginButton = function(handler) {
				// Login button
				var $button = $("<div class='actionIcon mssfbLoginButton parentPosition'></div>");
				var $link = $("<a class='mssfbLoginLink'><i class='uiIconColorWarning'></i></a>");
				$button.append($link);
				// Login click handler
				if (handler) {
					$link.click(handler);
				}
				// Popover on the button
				var $popoverContainer = $("<div class='gotPosition' style='position: relative; display:block'></div>");
				$popoverContainer.append("<div class='popover bottom popupOverContent' style='display: none;'>"
							+ "<span class='arrow' style='top: -8%;'></span>"
							+ "<div class='popover-content'>" + provider.getTitle() 
								+ " authorization required. Click this icon to open sign-in window.</div>"
							+ "</div>");
				$button.append($popoverContainer);
				var $popover = $popoverContainer.find(".popupOverContent:first");
				$link.mouseenter(function() {
					if (!$popover.is(":visible")) {
						$popover.show("fade", 300);
					}
				});
				$link.mouseleave(function() {
					if ($popover.is(":visible")) {
						$popover.hide("fade", 300);
					}
				});
				setTimeout(function() {
					$popover.show("fade", 1500);
				}, 2000);
				// hide popover in time
				setTimeout(function() {
					$popover.hide("fade", 1500);
				}, 30000);
				return $button;
			};
			
			var createLogoutButton = function(handler) {
				var $button = $("<div class='actionIcon mssfbLogoutButton parentPosition'></div>");
				var $link = $("<a class='mssfbLogoutLink' data-placement='bottom' rel='tooltip' title='' data-original-title='Settings'><i class='uiIconSettings uiIconLightGray'></i></a>");
				$button.append($link);
				$link.tooltip();
	    	if (handler) {
	    		$link.click(handler);
	    	}
	    	return $button;
			};
			
			var createCallAccountPopover = function($button) {
				if ($button.find(".gotPosition>.popover").length == 0) {
					var $a = $button.find(".actionIcon>a");
					var $link = $a.length > 0 ? $a : $button;
					// Popover on the button
					var $popoverContainer = $("<div class='gotPosition' style='position: relative; display:block'></div>");
					$popoverContainer.append("<div class='popover bottom popupOverContent' style='display: none;'>"
								+ "<span class='arrow' style='top: -8%;'></span>"
								+ "<div class='popover-content'>This account will be used for " + provider.getTitle() + " calls.</div>"
								+ "</div>");
					$button.append($popoverContainer);
					var $popover = $popoverContainer.find(".popupOverContent:first");
					$link.mouseenter(function() {
						if (!$popover.is(":visible")) {
							$popover.show("fade", 300);
						}
					});
					$link.mouseleave(function() {
						if ($popover.is(":visible")) {
							$popover.hide("fade", 300);
						}
					});
					setTimeout(function() {
						$popover.show("fade", 1500);
					}, 2000);
					// hide popover in time
					setTimeout(function() {
						$popover.hide("fade", 1500);
					}, 10000);
					return $button;
				}
			};
			
			this.init = function(context) {
				//log("Init at " + location.origin + location.pathname);
				if (window.location.pathname.startsWith("/portal/") && window.location.pathname.indexOf("/edit-profile/") > 0) {
					// in user profile edit page 
					var $form = $("#UIEditUserProfileForm");
					if ($form.length > 0) {
						var $ims = $form.find("#ims");
						var removeToken = false;
						var addControlButton = function($imRow, createFunc) {
							$imRow.find(".mssfbControl").remove();
							var $button = createFunc();
							$button.addClass("mssfbControl");
							$imRow.find(".selectInput+.actionIcon").after($button);
							return $button;
						};
						var controlHandler = function() {
							var $imRow = $(this).parents(".controls-row:first");
							var mssfbId = sipId($imRow.find(".selectInput").val());
							var token = currentToken();
							if (token && token.userId == mssfbId) {
								// User can forget the token
								showSettingsLogout().done(function() {
									// show warn next to SfB IM field
									showLoginButton($imRow);
								});
							} else {
								// User needs login with his (new) SfM account
								showSettingsLogin(mssfbId).done(function() {
									// show settings (logout for now) icon next to SfB IM field
									showLogoutButton($imRow);									
								});
							}
						};
						var showLoginButton = function($imRow) {
							return addControlButton($imRow, function() {
								return createLoginButton(controlHandler);
							});
						};
						var showLogoutButton = function($imRow) {
							var $button = addControlButton($imRow, function() {
								return createLogoutButton(controlHandler);
							});
							if ($ims.find(".mssfbControl:visible").length > 1) {
								createCallAccountPopover($button);
							}
							return $button; 
						};
						var controlInit = function($imRow, mssfbId) {
							var token = currentToken();
							if (token && token.userId == mssfbId) {
								return showLogoutButton($imRow);
							} else {
								return showLoginButton($imRow);
							}
						};
						var imChangeHandler = function($imRow) {
							// FYI $imRow should be a single row, otherwise this method will work wrong!
							if ($imRow.data("mssfbinit")) {
								return true;
							} else {
								$imRow.data("mssfbinit", true);
								var $imType = $imRow.find("select.selectbox");
								var $im = $imRow.find(".selectInput");
								var $control = $imRow.find(".mssfbControl");
								var isMssfbSelected = function() {
									return $imType.find(":selected").val() == "mssfb";
								};
								var isMssfb = isMssfbSelected();
								var initControl = function() {
									if (isMssfb) {
										var im = $im.val();
								    if (EMAIL_PATTERN.test(im)) {
								    	removeToken = false;
								    	// Already looks as an email, we can show login Icon on the right if it is not already there
								    	if ($control.length == 0) {
								    		$control = controlInit($imRow, sipId(im));
								    	} else {
								    		$control.show();
								    	}
								    } else {
								    	// TODO mark this filed invalid
								    	removeToken = true;
								    	$control.hide();
								    }
									} else {
							    	// else, not SfB IM
										removeToken = true;
							    	$control.hide();
							    }
								};
								$imType.change(function() {
									isMssfb = isMssfbSelected();
									initControl();
								});
								$im.on("input", function() { 
									initControl(); 
								});
								if (isMssfb) {
									removeToken = false;
								}
								return isMssfb;
							}
						};
						var initForm = function() {
							var hasMssfb = false;
							$ims.find(".controls-row").each(function() {
								// Add change handler only to first SfB IM
								var $imRow = $(this);
								if (!hasMssfb && imChangeHandler($imRow)) {
									hasMssfb = true;
									var mssfbId = sipId($imRow.find(".selectInput").val());
									controlInit($imRow, mssfbId);
								} else {
									// XXX we don't support multiple SfB for calls - remove settings control
									$imRow.find(".mssfbControl").remove();
								}
							});
						};
						initForm();
						$form.find(".uiAction .btn-save").click(function() {
							if (removeToken) {
								removeLocalToken();
								removeToken = false;
							}							
						});
						// We need also handle added IM rows by later Add New (+) actions 
						setTimeout(function() {
							var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
							var observer = new MutationObserver(function(mutations) {
								// will it fired twice on each update?
								var needUpdate = false;
								nextChange : for (var i=0; i<mutations.length; i++) {
									var m = mutations[i];
									if (m.type == "childList") {
										//var $node = $(m.target);
										//log(">> observed: " + $node.attr("class"));
										for (var i = 0; i < m.addedNodes.length; i++) {
										  var $node = $(m.addedNodes[i]);
										  if ($node.hasClass("controls-row")) {
												needUpdate = true;
												break nextChange;
											}
										}
									}
								} 
								if (needUpdate) {
									initForm();
								}
							});
							observer.observe($ims.get(0), {
								subtree : false,
								childList : true,
								attributes : false,
								characterData : false
							});
						}, 1000);
					} else {
						log("WARN UIEditUserProfileForm not found");
					}
				} else if (videoCalls.hasChatApplication()) {
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
											var c = container.getConversation();
											var cstate = c.state();
											if (cstate == "Connecting" || cstate == "Connected") {
												c.leave().then(function() {
													log("<<< leaved call " + getCallId(c));
												}, function(err) {
													log("<<< error leaving call " + getCallId(c) + " " + JSON.stringify(err));
												});
											} else if (cstate == "Conferencing" || cstate == "Conferenced") {
												var pcount = c.participantsCount();
												c.leave().then(function() {
													log("<<< leaved conference call " + getCallId(c) + " parts: " + pcount + "->" + c.participantsCount());
												}, function(err) {
													log("<<< error leaving conference call " + getCallId(c) + " " + JSON.stringify(err));
												});
												// TODO it is a better way to close the call?
												/*c.activeModalities.video.when(true, function() {
											    c.videoService.stop();
												});
												c.activeModalities.audio.when(true, function() {
											    c.audioService.stop();
												});
												c.activeModalities.chat.when(true, function() {
											    c.chatService.stop();
												});*/										
											}
										}
										container.hide();
									});
									var chatsZ = $chats.css("z-index");
									if (typeof(chatsZ) == "Number") {
										chatsZ++;
									} else {
										chatsZ = 99;
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
										//log(">>> aligned call container in chats");
										$(window).resize();
									}, 1500);
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
								var $users = $chat.find("#chat-users");
								var joinedCall = null;
								var moveCallContainer = function(forceDetach) {
									// TODO is ti possible to get rid the timer and rely on actual DOM update for the chat?
									setTimeout(function() {
										if ($container.is(":visible")) {
											var roomId = chatApplication.targetUser;
											if (roomId && joinedCall) {
												var roomTitle = chatApplication.targetFullname;
												if (container.isAttached()) {
													if (forceDetach || roomId != joinedCall.peer.chatRoom) {
														// move call container to the window top-center with smaller size
														//log(">>> room not of the call < " + roomTitle);
														alignWindowMiniCallContainer($container);
														container.detached();
													} // else, do nothing
												} else {
													if (roomId == joinedCall.peer.chatRoom) {
														// move call container to the current room chats size
														//log(">>> room of the call > " + roomTitle);
														alignChatsCallContainer($chats, $container);
														container.attached();
													} // else, do nothing
												}
											}
										}
									}, 1200);
								};
								// If user later will click another room during the call, we move the call container to a window top
								// if user will get back to the active call room, we will resize the container to that call chats
								$users.click(function() {
									moveCallContainer(false);
								});
								$chat.find(".uiRightContainerArea #room-detail>#back").click(function() {
									moveCallContainer(true);
								});
								// Init update procedure common for the whole provider
								//var userStatus;
								var activeRooms = {};
								// Mark timeout should be longer of used one below in callUpdate() 'accepted' 
								var markRoom = function(id, markFunc) {
									activeRooms[id] = markFunc;
									// XXX Do twice: sooner and after possible refreshes caused by callUpdate() 'accepted' 
									setTimeout(markFunc, 750);
									setTimeout(markFunc, 2750);
								};
								var unmarkRoom = function(roomId) {
									delete activeRooms[roomId];
									setTimeout(function() {
										var $room = $users.find("#users-online-" + roomId);
										$room.removeClass("activeCall");
										$room.removeClass("incomingCall");
									}, 750);
								};
								var markRoomActive = function(roomId) {
									markRoom(roomId, function() {
										var $room = $users.find("#users-online-" + roomId);
										if (!$room.hasClass("activeCall")) {
											$room.addClass("activeCall");
										}
										$room.removeClass("startingCall");
									});
								};
								var markRoomIncoming = function(roomId) {
									markRoom(roomId, function() {
										// mark Chat room icon red blinking (aka incoming)
										var $room = $users.find("#users-online-" + roomId);
										if (!$room.hasClass("activeCall")) {
											$room.addClass("activeCall");
										}
										if (!$room.hasClass("startingCall")) {
											$room.addClass("startingCall");
										};
									});
								};
								setTimeout(function() {
									var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
									var observer = new MutationObserver(function(mutations) {
										// will it fired twice on each update?
										for (var id in activeRooms) {
											if (activeRooms.hasOwnProperty(id)) {
												var roomFunc = activeRooms[id];
												markRoom(id, roomFunc);
											}
										}
									});
									observer.observe($users.get(0), {
										subtree : true,
										childList : true,
										attributes : false,
										characterData : false
									});
								}, 2500);
								hasJoinedCall = function(callRef) {
									return joinedCall ? callRef == joinedCall.peer.id || callRef == joinedCall.peer.chatRoom : false;
								};
								callUpdate = function(info) {
									log(">>> callUpdate: [" + info.state + "] " + (info.saved ? "[saved]" : "") + " " + info.callId + " peer: " + JSON.stringify(info.peer));
									if (info.state) {
										// 'started' and 'stopped' can be remote (saved) events for group calls, 
										// when an one initiated and when last part leaved respectively 
										// 'incoming' only local, it is first for an incoming call 
										// 'accepted' only local, it is second event for incoming when user accepts it, otherwise 'canceled' will be next
										// 'started' is a first event for P2P outgoing and a next for P2P incoming
										// 'joined' is a first event for group outgoing and a next for group incoming
										// 'leaved' when user leaves a group call (it still may run)
										// 'stopped' for finished call, locally (P2P or group) or remotely (group only) initiated
										// 'canceled' when user declined the call or timeout happened waiting the dialog
										var isGroup = info.callId.startsWith("g/");
										var $callButton = $chat.find("#room-detail .mssfbCallAction");
										if (info.state == "incoming") {
											// Do need change Chat UI for this event?
											markRoomIncoming(info.peer.chatRoom);
										} else if (info.state == "accepted") {
											saveLocalCall(info);
											// if call container was running a convo, it is leaving right here (see accepted logic)
											joinedCall = info; 
											if (info.peer.chatRoom != chatApplication.targetUser) {
												// switch to the call room in the Chat
												var selector = ".users-online .room-link[user-data='" + info.peer.chatRoom + "']";
												var $rooms = $users.find(selector);
												if ($rooms.length == 0) {
													// try find in the history/offline
													$chat.find(".btn-history:not(.active)").click();
													setTimeout(function() {
														$chat.find(".btn-offline:not(.active)").click();
														setTimeout(function() {
															$users.find(selector).first().click();
														}, 1000);
													}, 1000);
													//$chat.find(".btn-history, .btn-offline").filter(":not(.active)").click();
													// TODO do we want hide opened offline/history rooms?
												} else {
													$rooms.first().click();
												}												
											}
											markRoomActive(info.peer.chatRoom);
										} else if (info.state == "started") {
											saveLocalCall(info);
											if (chatApplication.targetUser == info.peer.chatRoom) {
												// this call room is current open in Chat
												if (info.conversation) { // !info.saved && - for repeated it will be true
													// it's started outgoing call
													joinedCall = info;
													//if ($callButton.data("callid") == info.callId) {
													if (!$callButton.hasClass("callDisabled")) {
														$callButton.addClass("callDisabled");
													}
												} else if (isGroup) {
													$callButton.find(".callTitle").text(self.getJoinTitle());
												}
											}
											// set user status: do-not-disturb, remember current status
											/*chatNotification.getStatus(chatApplication.username, function(status) {
												chatApplication.setStatusDoNotDisturb();
												userStatus = status;
											});*/
											markRoomActive(info.peer.chatRoom);
										} else if (info.state == "stopped") {
											saveLocalCall(info);
											if (joinedCall && joinedCall.callId == info.callId) {
												joinedCall = null;
											}
											if (chatApplication.targetUser == info.peer.chatRoom) {
												if (isGroup) {
													// this (group) call room is current open in Chat
													$callButton.find(".callTitle").text(self.getCallTitle());
												}
												$callButton.removeClass("callDisabled");
											}
											/*if (userStatus) {
												// set user status to a previous one
												chatApplication.setStatus(userStatus);
												userStatus = null;
											}*/
											//} // otherwise user still works in the call, 'stopped' will be fired when the container will be closed on this page
											unmarkRoom(info.peer.chatRoom);
										} else if (info.state == "joined") {
											saveLocalCall(info);
											joinedCall = info;
											//if ($callButton.data("callid") == info.callId) {
											if (chatApplication.targetUser == info.peer.chatRoom) {
												if (!$callButton.hasClass("callDisabled")) {
													$callButton.addClass("callDisabled");
												}
											}
										} else if (info.state == "leaved") {
											saveLocalCall(info);
											var hasLeaved = false;
											if (joinedCall && joinedCall.callId == info.callId) {
												joinedCall = null;
												hasLeaved = true;
											}
											//if ($callButton.data("callid") == info.callId) {
											if (chatApplication.targetUser == info.peer.chatRoom) {
												$callButton.removeClass("callDisabled");
												if (isGroup && hasLeaved) {
													$callButton.find(".callTitle").text(self.getJoinTitle());
												}
											}
										} else if (info.state == "canceled") {
											saveLocalCall(info);
											//if ($callButton.data("callid") == info.callId) {
											if (chatApplication.targetUser == info.peer.chatRoom) {
												if (isGroup) {
													$callButton.find(".callTitle").text(self.getJoinTitle());													
												} // else, for P2P we don't do anything
											}
											markRoomActive(info.peer.chatRoom);
										} else {
											log("<<< Unexpected call update status: " + JSON.stringify(info));
										}
									} else if (info.error) {
										log("<<< Call update error: " + JSON.stringify(info));
									}
								};
								initializer.done(function(api, app) {
									log("Automatic login done.");
									incomingCallHandler(api, app, container);
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
												incomingCallHandler(api, app, container);
											});
											callback.fail(function(err) {
												videoCalls.showError(provider.getTitle() + " error", "Unable sign in your " + provider.getTitle() + " account. " + err);
											});
											return callback.promise();
										}
									};
									// show warn icon near the Call Button, icon with click and details popover
									var MAX_WAIT = 24; // 6sec = 24 * 250ms
									var attemtCount = 0;
									var addLoginWarn = function(wait) {
										var $wrapper = $roomDetail.find(".callButtonContainerWrapper");
										if ($wrapper.length == 0 && wait) {
											if (attemtCount < MAX_WAIT) {
												// wait a bit and try again
												attemtCount++;
												setTimeout(function() {
													addLoginWarn(attemtCount < MAX_WAIT);
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
										} else if (!$wrapper.data("callloginwarned")) {
											$wrapper.data("callloginwarned", true);
											// add the link/icon with warning and login popup
											// this warning will be removed by loginTokenHandler() on done
											$chat.find(".mssfbLoginButton").remove();
											var $button = createLoginButton(userLogin);
											if ($roomDetail.is(":visible")) {
												// Show in room info near the call button or team dropdown
												$button.addClass("pull-right");
												if ($wrapper.length > 0) {
												 $wrapper.after($button);
												} else {
												 $roomDetail.find("#chat-team-button-dropdown").after($button);
												}	
											} else {
												// Show in .selectUserStatus after the user name
												$button.addClass("pull-left");
												$chat.find(".no-user-selection .selectUserStatus+label:first").after($button);												
											}
																						
											////
											/*$chat.find(".mssfbLoginWarningContainer").remove();
											var $button = $("<div class='mssfbLoginWarningContainer parentPosition'></div>");
											var $loginLink = $("<a href='#' class='mssfbLoginWarningLink'><i class='uiIconColorWarning'></i></a>");
											$button.append($loginLink);
											$loginLink.click(function() {
												userLogin();										
											});
											var $popoverContainer = $("<div class='gotPosition' style='position: relative; display:block'></div>");
											$popoverContainer.append("<div class='popover bottom popupOverContent' style='display: none;'>"
														+ "<span class='arrow' style='top: -8%;'></span>"
														+ "<div class='popover-content'>" + provider.getTitle() 
															+ " authorization required. Click this icon to open sign-in window.</div>"
														+ "</div>");
											$button.append($popoverContainer);
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
											}, 30000);*/
										}
									};
									addLoginWarn(true);
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
									localStorage.removeItem(TOKEN_STORE);
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

		log("< Loaded at " + location.origin + location.pathname + " -- " + new Date().toLocaleString());
		
		return provider;
	} else {
		log("WARN: videoCalls not given and eXo.videoCalls not defined. Skype provider registration skipped.");
	}
})($, typeof videoCalls != "undefined" ? videoCalls : null );
