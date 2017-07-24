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
						// TODO save token in the server-side for late use?
					  log("Login OK, app created OK");
					  // Save the token hash in local storage for later use
					  location.hash = prevHash;
					  saveLocalToken(token);
					  process.resolve(api, app);
					  // Remove warnings if any
					  // TODO check exactly that the SfB authorized 
						$(".mssfbLoginWarningContainer").remove();
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
				if (error.code == "CommandDisabled" || error.code == "AssertionFailed" || (error.code == "InvitationFailed" && error.reason.subcode == "UnsupportedMediaType")) {
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
			
			// target, participants, localConvo
			var outgoingCallHandler = function(api, app, container, currentUser, target, userIds, participants, conversation) {
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
											var lpid = participants[pi];
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
						logConversation(conversation);
						container.setConversation(conversation, target.id);
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
						var added = false;
						var addCall = function() {
							if (!added && callId != "g/adhoc") {
								//log(">>> Registering " + callId + " > " + new Date().getTime());
								added = true;
								var ownerType, ownerId;
								if (target.group) {
									ownerType = target.type;
									ownerId = target.id;									
								} else {
									ownerType = "user";
									ownerId = currentUser.id;
								}
								var callInfo = {
									owner : ownerId,
									ownerType : ownerType,  
									provider : provider.getType(),
									title : conversation.topic(),
									participants : userIds.join(";") // eXo user ids here
								};
								videoCalls.addCall(callId, callInfo).done(function(call) {
									log(">>> Added " + callId + " parts:" + conversation.participantsCount() + " > " + new Date().getTime());
								}).fail(function(err) {
									registered = false;
									log(">>> ERROR adding " + callId + ": " + JSON.stringify(err));
								});
							}
						};
						var updateCall = function(state) {
							videoCalls.updateCall(callId, state).done(function(call) {
								log("<<< " + state + " " + callId + " parts:" + conversation.participantsCount() + " > " + new Date().getTime());
							}).fail(function(err) {
								log("<<< ERROR updating to " + state + " " + callId + ": " + JSON.stringify(err));
							});								
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
						var started = false;
						var startingCall = function(stateName) {
							if (!started) {
								started = true;
								callId = getCallId(conversation);
								log(">>> " + stateName + " outgoing " + callId);
								if (conversation.isGroupConversation()) {
									if (target.callId) {
										updateCall("started");
									} else {
										addCall();
									}
								}
								process.resolve(callId, conversation);
								/*conversation.state.once("Connected", function() {
									// FIXME several such listeners may register if convo was declined remotely or filed to connect
									log(">>> Connected outgoing " + callId);
									process.resolve(callId, conversation);
								});*/
								conversation.state.once("Disconnected", function() {
									log("<<< Disconnected outgoing " + callId);
									if (conversation.isGroupConversation()) {
										updateCall("stopped");
									}
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
									if (isError) {
										if (process.state() == "pending") {
											process.reject(error);
										}
									} 
									if (isOutdated) {
										app.conversationsManager.conversations.remove(conversation);
										// delete this call records in eXo service
										target.callId = null;
										videoCalls.deleteCall(callId).always(function() {
											// Wait a bit for things completion
											setTimeout(function() {
												outgoingCallHandler(api, app, container, currentUser, target, userIds, participants, null).done(function(callId, newConvo) {
													process.resolve(callId, newConvo);
												}).fail(function(err) {
													process.reject(err);
												});											
											}, 250);
										}).done(function() {
											log("<<< Deleted " + callId + " parts:" + conversation.participantsCount() + " > " + new Date().getTime());
										}).fail(function(err) {
											log("<<< ERROR deleting " + callId + ": " + JSON.stringify(err));
										});								
									} else {
										unregisterCall(); // TODO Do need it here? It will be done on Disconnected state also.
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
			
			this.callButton = function(context) {
				var button = $.Deferred();
				if (settings && context && context.currentUser) {
					// TODO temporarily we don't support calling regular Skype users
					//context.currentUserSkype = videoCalls.imAccount(context.currentUser, "skype");
					var currentUserSFB = videoCalls.imAccount(context.currentUser, "mssfb");
					if (currentUserSFB) {
						context.currentUserSFB = currentUserSFB;
						var fullTitle = self.getTitle() + " " + self.getCallTitle();
						var $button = $("<a title='" + fullTitle + "' href='javascript:void(0);' class='mssfbCallAction'>"
									+ "<i class='uiIconMssfbCall uiIconForum uiIconLightGray'></i>"
									+ "<span class='callTitle'>" + self.getCallTitle() + "</span></a>");
						setTimeout(function() {
							if (!$button.hasClass("btn")) {
								// in dropdown show longer description
								$button.find(".callTitle").text(fullTitle);
							}
						}, 1000);
						$button.click(function() {
							context.details().done(function(target) { // users, convName, convTitle
								var ims = []; // for call on a new page
								var participants = []; // for embedded call
								var users = [];
								var wrongUsers = [];
								var addParticipant = function(user) {
									//var uskype = videoCalls.imAccount(u, "skype");
									var ubusiness = videoCalls.imAccount(user, "mssfb");
									if (ubusiness) {
										if (ubusiness.id != context.currentUserSFB.id) {
											if (EMAIL_PATTERN.test(ubusiness.id)) {
												participants.push(ubusiness.id);
												users.push(user.id);
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
								if (participants.length > 0) {
									var container = $("#mssfb-call-container").data("callcontainer");
									if (container) {
										// Call from Chat room on the same page
										var saveConvo = function(callId, conversation) {
											log(">>> saveConvo: " + callId);
											localConvos[callId] = conversation;
										};
										var localConvo;
										if (target.callId) {
											localConvo = localConvos[target.callId];
										}
										// We will try reuse saved locally SfB token
										var token = currentToken();
										if (token && uiApiInstance && uiAppInstance) {
											log("Automatic login done.");
											outgoingCallHandler(uiApiInstance, uiAppInstance, container, context.currentUser, target, users, participants, localConvo).done(saveConvo);
											showWrongUsers(wrongUsers);
										} else {
											// we need try SfB login window in hidden iframe (if user already logged in AD, then it will work)
											// FYI this iframe will fail due to 'X-Frame-Options' to 'deny' set by MS
											// TODO may be another URL found to do this? - see incoming call handler for code
											// need login user explicitly (in a popup)
											log("Automatic login failed: login token not found or expired");
											loginWindow();
											provider.loginToken = function(token) {
												var callback = loginTokenHandler(token);
												callback.done(function(api, app) {
													log("User login done.");
													makeCallPopover("Make " + provider.getTitle() + " call?", "Do you want call " + target.title + "?").done(function() {
														outgoingCallHandler(api, app, container, context.currentUser, target, users, participants, localConvo).done(saveConvo);														
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
										showWrongUsers(wrongUsers, callWindow);
									}
								} else {
									videoCalls.showWarn("Cannot start a call", "No " + self.getTitle() + " users found.");
								}
							}).fail(function(err) {
								videoCalls.showWarn("Error starting a call", err.message);
							});							
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
			
			var incomingCallHandler = function(api, app, container) {
				var $callPopup;
				var handleIncoming = function(conversation, saved) {
					var callId = getCallId(conversation);
					log(conversation.state() + " call: " + callId);
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
									$callPopup = $call;
									$callPopup.callId = callId;
									conversation.state.changed(function listener(newValue, reason, oldValue) {
										// convo may be already in Disconnected state for saved calls
										if (newValue === "Disconnected" && (oldValue === "Connected" || oldValue === "Connecting" || oldValue === "Conferencing" || oldValue === "Conferenced")) {
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
											if (saved) {
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
												var added = false;
												var addUserGroupCall = function() {
													if (!added && conversation.isGroupConversation()) {
														added = true;
														videoCalls.addUserGroupCall(callId).fail(function(err, status) {
															log("<<< Error adding user group call: " + callId + ". " + JSON.stringify(err) + " [" + status + "]");
														});
													}
												};
												conversation.selfParticipant.chat.state.changed(function listener(newValue, reason, oldValue) {
													log(">>> CHAT state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																+ " CONVERSATION state: " + conversation.state());
													if (newValue === "Notified") {
														conversation.chatService.accept().then(function() {
															log(">>> Incoming CHAT ACCEPTED");
															accept.resolve("chat");
															addUserGroupCall();
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
												conversation.selfParticipant.audio.state.changed(function listener(newValue, reason, oldValue) {
													log(">>> AUDIO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																+ " CONVERSATION state: " + conversation.state());
													if (newValue === "Notified") {
														conversation.audioService.accept().then(function() {
															log(">>> Incoming AUDIO ACCEPTED");
															accept.resolve("audio");
															addUserGroupCall();
														}, function(audioError) {
															log("<<< Error accepting audio: " + JSON.stringify(audioError));
															accept.reject(audioError);
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
												conversation.selfParticipant.video.state.changed(function listener(newValue, reason, oldValue) {
													// 'Notified' indicates that there is an incoming call
													log(">>> VIDEO state changed " + callId + ": " + oldValue + "->" + newValue + " reason:" + reason
																+ " CONVERSATION state: " + conversation.state());
													if (newValue === "Notified") {
														// TODO in case of video error, but audio or chat success - show a hint message to an user and auto-hide it
														conversation.videoService.accept().then(function() {
															log(">>> Incoming VIDEO ACCEPTED");
															accept.resolve("video");
															addUserGroupCall();
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
							//log(">>> Get registered " + callId + " > " + new Date().getTime());
							if (conversation.isGroupConversation()) {
							var callInfo = videoCalls.getCall(callId);
								callInfo.done(function(call) {
									log(">>> Got registered " + callId + " > " + new Date().getTime());
									callerId = call.owner.id;
									callerLink = call.ownerLink;
									callerAvatar = call.avatarLink;
									callerMessage = call.title + " conference call.";
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
							} else {
								showCallPopover();
							}
						}
						return accept.promise();
					};
					
					log(">> selfParticipant: " + conversation.selfParticipant.state());
					log(">> videoService.accept.enabled: " + conversation.videoService.accept.enabled());
					log(">> audioService.accept.enabled: " + conversation.audioService.accept.enabled());
					log(">> videoService.start.enabled: " + conversation.videoService.start.enabled());
					log(">> audioService.start.enabled: " + conversation.audioService.start.enabled());
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
						delete localConvos[callId];
						delete logging[key];
					});
					app.conversationsManager.conversations.added(function(conversation, key, index) {
						logConversation(conversation, key, index);
						var state = conversation.state();
						if (state == "Incoming") {
							log(">>> Incoming (added) " + getCallId(conversation));
							handleIncoming(conversation);
						} else if (state == "Created") {
							// Late it may become Incoming
							conversation.state.once("Incoming", function() {
								// Update call ID as it will change after first Connecting
								if (conversation != container.getConversation()) {
									log(">>> Created (added) > Incoming " + getCallId(conversation));
									handleIncoming(conversation);									
								} else {
									log(">>> Created (added) < Incoming already handled " + getCallId(conversation));
								}
							});
						}
					});
					// We also handle re-established group conferences (while it is not outdated by Skype services)
					videoCalls.getUserGroupCalls().done(function(list) {
						if (list && list.length > 0) {
							log(">>> User has registered group calls - start long polling for these calls updates " + JSON.stringify(list));
							(function poll(prevData, prevStatus) {
								var timeout = prevStatus == 0 ? 60000 : (prevStatus >= 400 ? 15000 : 250);
								setTimeout(function() {
									var userId = videoCalls.getUser().id;
									videoCalls.pollUserUpdates(userId).done(function(update, status) {
										if (update.eventType == "call_status") {
											log(">>> User call status updated: " + JSON.stringify(update) + " [" + status + "]");
											if (update.callStatus == "started") {
												var conversation = app.conversationsManager.getConversationByUri(update.callId.substring(2));
												if (conversation) {
													logConversation(conversation);
													var state = conversation.state();
													// Created - for restored saved, Conferenced - not happens, but if will, it has the same meaning
													// Disconnected - for previously conferenced on this page
													if (state == "Created" || state == "Disconnected" || state == "Conferenced") {
														log(">>>> Incoming (saved) " + update.callId);
														handleIncoming(conversation, true);
													} else {
														log("<<<< User call " + update.callId + " not active (" + conversation.state() + ")");
													}
												} else {
													log("<<<< User call " + update.callId + " not found in conversation manager");
												}
											} else if (update.callStatus == "stopped") {
												// Hide accept popover for this call
												if ($callPopup && update.callId == $callPopup.callId) {
													if ($callPopup.is(":visible")) {
														$callPopup.dialog("close");
													}
												}
											}
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
						}
					}).fail(function(err, status) {
						log("<<< Error getting user group calls: " + JSON.stringify(err) + " [" + status + "]");
					});
				}).fail(function() {
					if (container) {
						container.init();
						container.$element.append($("<div><div class='pluginError'>Please install Skype web plugin.</div></div>"));
					} // else, user aleeady notified in pnotify warning 
				});
			};
			
			var alignWindowMiniCallContainer = function($container) {
				var aw = $(document).width();
				var ah = $(document).height();
				var w, h, top, left;
				if (aw > 760) {
					w = 280;
				  h = 140;
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
			this.init = function(context) {
				//log("Init at " + location.origin + location.pathname);
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
											if (cstate == "Connecting" || cstate == "Connected") {
												c.leave().then(function() {
													log("<<< leaved call " + getCallId(c));
												}, function(err) {
													log("<<< error leaving call " + getCallId(c) + " " + JSON.stringify(err));
												});
											} else if (cstate == "Conferencing" || cstate == "Conferenced") {//InvitationFailed
												c.leave().then(function() {
													log("<<< leaved conference call " + getCallId(c));
													//app.conversationsManager.conversations.remove(c);
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
										//log(">>> aligned call container in chats");
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
									var attemtCount = 0;
									var addLoginWarn = function(wait) {
										var $wrapper = $roomDetail.find(".callButtonContainerWrapper");
										if ($wrapper.length == 0 && wait) {
											if (attemtCount < 30) {
												// wait a bit and try again
												attemtCount++;
												setTimeout(function() {
													addLoginWarn(attemtCount < 30);
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
											$chat.find(".mssfbLoginWarningContainer").remove();
											var $loginLinkContainer = $("<div class='mssfbLoginWarningContainer parentPosition'></div>");
											var $loginLink = $("<a href='#' class='mssfbLoginWarningLink'><i class='uiIconColorWarning'></i></a>");
											$loginLinkContainer.append($loginLink);
											if ($roomDetail.is(":visible")) {
												// Show in room info near the call button or team dropdown
												$loginLinkContainer.addClass("pull-right");
												if ($wrapper.length > 0) {
												 $wrapper.after($loginLinkContainer);
												} else {
												 $roomDetail.find("#chat-team-button-dropdown").after($loginLinkContainer);
												}	
											} else {
												// Show in .selectUserStatus after the user name
												$loginLinkContainer.addClass("pull-left");
												$chat.find(".no-user-selection .selectUserStatus+label:first").after($loginLinkContainer);												
											}
											
											$loginLink.click(function() {
												userLogin();										
											});
											var $popoverContainer = $("<div class='gotPosition' style='position: relative; display:block'></div>");
											$popoverContainer.append("<div class='popover bottom popupOverContent' style='display: none;'>"
														+ "<span class='arrow' style='top: -8%;'></span>"
														+ "<div class='popover-content'>" + provider.getTitle() 
															+ " authorization required. Click this icon to open sign-in window.</div>"
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
								var moveCallContainer = function(forceDetach) {
									// TODO is ti possible to get rid the timer and rely on actual DOM update for the chat?
									setTimeout(function() {
										if ($container.is(":visible")) {
											var roomId = chatApplication.targetUser;
											var roomTitle = chatApplication.targetFullname;
											if (roomId && container.getCallerId()) {
												if (container.isAttached()) {
													if (forceDetach || roomId != container.getCallerId()) {
														// move call container to the window top-center with smaller size
														log(">>> room not of the call < " + roomTitle);
														alignWindowMiniCallContainer($container);
														container.detached();
													} // else, do nothing
												} else {
													if (roomId == container.getCallerId()) {
														// move call container to the current room chats size
														log(">>> room of the call > " + roomTitle);
														alignChatsCallContainer($chats, $container);
														container.attached();
													} // else, do nothing
												}
											}
										}
									}, 1200);
								};
								var $users = $chat.find("#chat-users");
								$users.click(function() {
									moveCallContainer(false);
								});
								$chat.find(".uiRightContainerArea #room-detail>#back").click(function() {
									moveCallContainer(true);
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
