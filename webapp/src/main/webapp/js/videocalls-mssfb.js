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
	log("> Loading at " + location.href);
	
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

		function SfBProvider() {
			var EMAIL_PATTERN = /\S+@\S+[\.]*\S+/;
			
			var MSONLINE_LOGIN_PREFIX = "https://login.microsoftonline.com";
			
			var self = this;
			var settings, currentKey;
			var appInstance, uiAppInstance;
			
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
					if (appInstance) {
						log("Use app instance: " + appInstance);
						initializer.resolve(appInstance);
					} else {
						var user = videoCalls.getUser();
						var sessionId = user.name + "_session" + Math.floor((Math.random() * 1000000) + 1);
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
								if (mssfbUserId.startsWith("sip:")) {
									mssfbUserId = mssfbUserId.slice(4);
								}
								if (exoUserSFB && exoUserSFB.id != mssfbUserId) {
									// bad, we cannot proceed - need ask local user login with his account in MS
									log("Skype user and local eXo user have different Microsoft IDs: " + mssfbUserId + " vs " + exoUserSFB.id);
									initializer.reject("Skype user signed in under different account: " + mssfbUserId +
											". Please login as " + exoUserSFB.id);
								} else {
									// else, we don't care here if it is SfB user on eXo side
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
					if (uiAppInstance) {
						log("Use uiApp instance: " + uiAppInstance);
						initializer.resolve(uiAppInstance);
					} else {
						var user = videoCalls.getUser();
						var sessionId = user.name + "_uisession" + Math.floor((Math.random() * 1000000) + 1);
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
								if (mssfbUserId.startsWith("sip:")) {
									mssfbUserId = mssfbUserId.slice(4);
								}
								if (exoUserSFB && exoUserSFB.id != mssfbUserId) {
									// bad, we cannot proceed - need ask local user login with his account in MS
									log("Skype user and local eXo user have different Microsoft IDs: " + mssfbUserId + " vs " + exoUserSFB.id);
									initializer.reject("Skype user signed in under different account: " + mssfbUserId +
											". Please login as " + exoUserSFB.id);
								} else {
									// else, we don't care here if it is SfB user on eXo side
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

			this.callButton = function(context) {
				var button = $.Deferred();
				if (settings && context && context.currentUser) {
					// TODO temporarily we don't support calling regular Skype users
					//context.currentUserSkype = videoCalls.imAccount(context.currentUser, "skype");
					var currentUserSFB = videoCalls.imAccount(context.currentUser, "mssfb");
					if (currentUserSFB) {
						context.currentUserSFB = currentUserSFB;
						context.participants().done(function(users, convName, convTitle) {
							var rndText = Math.floor((Math.random() * 1000000) + 1);
							var linkId = "SkypeCall-" + convName + "-" + rndText;
							// TODO i18n for title
							var title;
							if (context.userName) {
								title = "Call with " + self.getTitle();
							} else {
								title = self.getTitle() + " Call";
							}
							var ims = [];
							var wrongUsers = [];
							for ( var uname in users) {
								if (users.hasOwnProperty(uname)) {
									var u = users[uname];
									//var uskype = videoCalls.imAccount(u, "skype");
									var ubusiness = videoCalls.imAccount(u, "mssfb");
									if (ubusiness) {
										if (ubusiness.id != context.currentUserSFB.id) {
											if (EMAIL_PATTERN.test(ubusiness.id)) {
												ims.push(encodeURIComponent(ubusiness.id));
											} else {
												wrongUsers.push(u);
											}
										}
									}
								}
							}
							if (ims.length > 0) {
								var userIMs = ims.join(";");
								var $button = $("<a id='" + linkId + "' title='" + title
											+ "' href='javascript:void(0);' class='mssfbCallAction'>"
											+ "<i class='uiIconMssfbCall uiIconForum uiIconLightGray'></i>"
													+ "<span class='callTitle'>" + self.getCallTitle() + "</span></a>");
								setTimeout(function() {
									if (!$button.hasClass("btn")) {
										// in dropdown show longer description
										$button.find(".callTitle").text(self.getTitle() + " " + self.getCallTitle());
									}
								}, 1000);
								$button.click(function() {
									// TODO check if such window isn't already open by this app
									var callUri = videoCalls.getBaseUrl() + "/portal/skype/call/_" + userIMs;
									var callWindow = authRedirectWindow(title, settings.clientId, callUri, "https://webdir.online.lync.com");
									if (wrongUsers.length > 0) {
										// inform the caller in call window
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
										$(callWindow).on("load", function() {
											var title = "Wrong Skype account" + s;
											var message = "Following user" + s + " " + have + " wrong business account: " + 
												userNames + ". " + who + " not added to the call.";
											log(title, message);
											notifyCaller(callWindow, title, message);
										});
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
				
			var loginUri = videoCalls.getBaseUrl() + "/portal/skype/call/login";
			var loginWindow = function() {
				return authRedirectWindow("Skype for Business Login", settings.clientId, loginUri, "https://webdir.online.lync.com");
			};
			var loginTokenHandler = function(token) {
				var process = $.Deferred();
				try {
					var prevHash = location.hash;
					location.hash = token.hash_line;
					var appInitializer = provider.application(loginUri);
					appInitializer.done(function(api, app) {
						// TODO save token in the server-side for late use
					  log("Login OK, app created OK, token: " + location.hash);
					  // Save the token hash in local storage for later use
					  if (typeof(Storage) !== "undefined") {
					    // Code for localStorage/sessionStorage.
					  	localStorage.setItem("mssfb_login_token", JSON.stringify(token));
						} else {
						  // Sorry! No Web Storage support..
							log("Error saving access token: local storage not supported.");
						}
					  process.resolve(api, app);
					});
					appInitializer.fail(function(err) {
						log("Login error: " + JSON.stringify(err));
					  process.reject(err);
					});
					appInitializer.always(function() {
						location.hash = prevHash;
						delete provider.loginToken;
					});
				} catch(e) {
					log("Error parsing even message", e);
				}
				return process.promise();
			};
			
			this.init = function() {
				log("Init at " + location.href);
				var $control = $(".mssfbControl");
				if ($control.length > 0) {
					// in user profile edit page 
					$control.click(function() {
						var $settings = $("div.uiMssfbSettings");
						if ($settings.length == 0) {
							$settings = $("<div class='uiMssfbSettings' title='Skype for Business settings'></div>");
							$(document.body).append($settings);
						} else {
							$settings.empty();
						}
						$settings.append($("<p><span class='ui-icon messageIcon ui-icon-gear' style='float:left; margin:12px 12px 20px 0;'></span>" +
							"<div class='messageText'>Login in to your Skype for Business account.</div></p>"));
						$settings.dialog({
				      resizable: false,
				      height: "auto",
				      width: 400,
				      modal: true,
				      buttons: {
				        "Login": function() {
				        	loginWindow();
				        	// this method will be available at globalVideoCalls.mssfb on a call page
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
					// we are in the Chat, try login using saved token
					// chatApplication is a global on chat app page
					var $chat = $("#chat-application");
					if ($chat.length > 0) {
						var initializer = $.Deferred();
						var userLogin = function() {
							loginWindow();
							provider.loginToken = function(token) {
								var callback = loginTokenHandler(token);
								callback.done(function(api, app) {
									// TODO setup incoming calls handler
									log("User login done.");
								});
								callback.fail(function(err) {
									videoCalls.showError("Skype for Business login error", "Unable login your user into Skype for Business account. " + err);
								});
								return callback.promise();
							}
						};
						if (typeof(Storage) !== "undefined") {
							var savedToken = localStorage.getItem("mssfb_login_token");
							if (savedToken) {
								// TODO try login user via invisible iframe
								// TODO in Session Storage we can find "swx-sessionid" it appears when SDK logged in, 
								// this record can be used as a flag of active session
								// TODO there are also several records in Local Storage
								try {
									var token = JSON.parse(savedToken);
									// cut a gap in 15sec for actual request processing
									var expiresIn = token.created + token.expires_in - 15;
									var now = new Date().getTime()/1000;
									if (now >= expiresIn) {
										// we need try MS auth URL in hidden iframe (if user already logged in AD, then it will work)
										var iframeUri = authRedirectLink("Skype for Business Login", settings.clientId, loginUri, "https://webdir.online.lync.com");
										var checksCount = 0;
										var checker = setInterval(function() {
											// check if $iframe not stays on MS server: it will mean we need login user explicitly
											var checkUri = $iframe.get(0).contentWindow.location.href;
											if (checksCount > 6) {
												clearInterval(checker);
												$iframe.remove();
												log("Login iframe check FAILED " + checksCount + ": " + checkUri);
												initializer.reject("User not logged in");
											} else if (checkUri.startsWith(MSONLINE_LOGIN_PREFIX)) {
												checksCount++;
												log("Login iframe check RUNNING " + checksCount + ": " + checkUri);
											} else {
												clearInterval(checker);
												log("Login iframe check DONE " + checksCount + ": " + checkUri);
											}
										}, 2500);
										var $iframe = $("<iframe src='" + iframeUri + "' height='0' width='0' style='display: none;'></iframe>");
										provider.loginToken = function(token) {
											var callback = loginTokenHandler(token);
											callback.done(function(api, app) {
												initializer.resolve(api, app);
											});
											callback.fail(function(err) {
												initializer.reject(err);
											});
											callback.always(function() {
												clearInterval(checker);
												$iframe.remove();
											});
											return callback.promise();
										};
										$(document.body).append($iframe);
									} else {
										// we reuse saved token on the Chat page
										var callback = loginTokenHandler(token);
										callback.done(function(api, app) {
											initializer.resolve(api, app);
										});
										callback.fail(function(err) {
											initializer.reject(err);
										});
									}
								} catch(e) {
									log("Login (saved) parsing error: " + e, e);
									localStorage.removeItem("mssfb_login_token");
									initializer.reject(e);
								}
							} else {
								initializer.reject("Token not found");
							}
						} else {
							log("Error reading access token: local storage not supported.");
							initializer.reject("Local storage not supported");
						}
						initializer.done(function(api, app) {
							// TODO setup incoming calls handler
							log("Automatic login done.");
						});
						initializer.fail(function(err) {
							// need login user explicitly (in a popup)
							log("Automatic login failed: " + err);
							var loginLinkId = "SfB_login_" + Math.floor((Math.random() * 1000) + 1);
							videoCalls.showWarn("Skype login required", "Please <a id='" + loginLinkId + "' href='#' style='text-decoration: underline;'>login</a> in your " +
									provider.getTitle() + " account to make you available.", function() {
								$("#" + loginLinkId).click(function() {
									// TODO login popup
								});
							});
							// TODO also add login button somewhere on the Chat page (in chat Preferences)
							/*
		<div class="span6">
    	<h4 class="global offset1" style="position: relative; left:0%;">Notifications</h4>
      <div id="id2" class="offset2 notif-trigger" style="position: relative; left: -6%;">
        <div class="uiSwitchBtn" style="width: 60px;"><input notif-trigger="notify-even-not-distrub" type="checkbox" class="switchBtnLabelOn yesno staus-true">
          <label class="switchBtnLabelOff" style="width: 51px;">
  					<span>OFF</span>
					</label>
					<label class="switchBtnLabelOn" style="width: 9px;">
						<span style="margin-left: -43px;">ON</span>
					</label>
					<div class="switchBtnHandle">
						<div class="switchBtnHandleRight">
  						<div class="switchBtnHandleCenter">
  						</div>
						</div>
					</div>
				</div>
  			<span class="channel-label"><b class="global">Do Not Disturb Notifications</b></span>
  			<span class="channel-label clearfix" style="position: relative; left: 18%;">
  				<i class="global">Notify me even when my status is Do Not Disturb</i>
  			</span>
  		</div>
    </div>
							 */
							var $prefsTemplate = $("#global-config-template");
							var $settings = $prefsTemplate.find(".uiMssfbSettings");
							if ($settings.length == 0) {
								$settings = $("<div class='uiMssfbSettings span6' title='Skype for Business settings'></div>");
								$settings.append("<h4 class='global offset1' style='position: relative; left:0%;'>Skype for Business settings</h4>"
											+ "<div class='offset2 notif-trigger' style='position: relative; left: -6%;'>"
											+ "<div class='uiSwitchBtn' style='width: 60px;'><input notif-trigger='notify-even-not-distrub' type='c' class='switchBtnLabelOn yesno staus-true'>"
											+	"<label class='switchBtnLabelOff' style='width: 51px;'><span>OFF</span></label>"
											+ "<label class='switchBtnLabelOn' style='width: 9px;'><span style='margin-left: -43px;'>ON</span></label>"
											+ "<div class='switchBtnHandle'><div class='switchBtnHandleRight'><div class='switchBtnHandleCenter'></div></div></div>"
											+ "</div>"
											+ "<span class='channel-label'><b class='global'>Automatic login in Skype for Business</b></span>"
											+ "<span class='channel-label clearfix' style='position: relative; left: 18%;'>"
											+ "<i class='global'>Login in your Skype for Business account automatically when open Chat page.</i>"
											+ "</span></div></div>");
								$prefsTemplate.find(".row:first").append($settings);
							}
							$chat.find("#configButtonResp").click(function() {
								// wait for all other inits
								// TODO is there a chance to use Chat's promise instead a timeout?
								setTimeout(function() {
									var $settings = $chat.find("#global-config .uiMssfbSettings");
									var $switch = $settings.find(".uiSwitchBtn");
									var $input = $switch.find("input");
									// XXX use Chat's jQuery with iPhone Style feature 
									jqchat("#global-config .uiMssfbSettings :checkbox").iphoneStyle();
									$switch.on("click touchstart", function() {
										log(">> SfB login: " + $input.is(":checked"));
										if ($input.is(":checked")) {
											// TODO show login, like in user profile
											
										}
									});
								}, 500);
							});
						});
					} else {
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
	//							location.hash = token.hash_line; 
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
			} catch(e) {
				log("Error loading Skype Call styles (for SfB).", e);
			}
		});

		log("< Loaded at " + location.href);
		
		return provider;
	} else {
		log("WARN: videoCalls not given and eXo.videoCalls not defined. Skype provider registration skipped.");
	}
})($, typeof videoCalls != "undefined" ? videoCalls : null );
