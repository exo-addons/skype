/**
 * Skype for Bunsiness provider module for Video Calls. This script will be used to add a provider to Video Calls module and then
 * handle calls for portal user/groups.
 */
(function($, videoCalls) {
	"use strict";

	/** For debug logging. */
	var objId = Math.floor((Math.random() * 1000) + 1);
	var logPrefix = "[mssfb_" + objId + "] ";
	function log(msg, e) {
		if (typeof console != "undefined" && typeof console.log != "undefined") {
			console.log(logPrefix + msg);
			if (e && typeof e.stack != "undefined") {
				console.log(e.stack);
			}
		}
	}

	var globalVideoCalls = typeof eXo != "undefined" && eXo && eXo.videoCalls ? eXo.videoCalls : null;
	
	// Use videoCalls from global eXo namespace (for non AMD uses)
	if (!videoCalls && globalVideoCalls) {
		videoCalls = globalVideoCalls;
	}

	if (videoCalls) {

		function SfBProvider() {
			var self = this;
			var settings, currentKey;
			var appInstance, uiAppInstance;
			
			var authRedirectWindow = function(title, clientId, redirectUri, resource) {
				var loginUri = "https://login.microsoftonline.com/common/oauth2/authorize?response_type=token&client_id="
					+ clientId
					+ "&redirect_uri="
					+ encodeURIComponent(redirectUri)
					+ "&resource="
					+ encodeURIComponent(resource);
				log("SfB login/call: " + loginUri);
				var theWindow = videoCalls.showCallPopup(loginUri, title);
				return theWindow;
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
								// TODO
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
								// TODO
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
								title = "Call with " + convTitle;
							} else {
								title = convTitle + " meeting";
							}
							// TODO i18n for title
							var ims = [];
							for ( var uname in users) {
								if (users.hasOwnProperty(uname)) {
									var u = users[uname];
									//var uskype = videoCalls.imAccount(u, "skype");
									var ubusiness = videoCalls.imAccount(u, "mssfb");
									if (ubusiness && ubusiness.id != context.currentUserSFB.id) {
										ims.push(encodeURIComponent(ubusiness.id));
									}
								}
							}
							if (ims.length > 0) {
								var userIMs = ims.join(";");
								var $button = $("<a id='" + linkId + "' title='" + title
											+ "' href='javascript:void(0);' class='mssfbCallIcon'>" + self.getCallTitle() + "</a>");
								$button.click(function() {
									// TODO check if such window isn't already open by this app
									var callUri = videoCalls.getBaseUrl() + "/portal/skype/call/_" + userIMs;
									var callWindow = authRedirectWindow(title, settings.clientId, callUri, "https://webdir.online.lync.com");
								});
								button.resolve($button);
							} else {
								button.reject("No " + self.getTitle() + " users found");
							}
						});
					} else {
						button.reject("Not SfB user");
					}
				} else {
					button.reject("Not configured or empty context for " + self.getTitle());
				}
				return button.promise();
			};
						
			this.init = function() {
				log("Init at " + window.location.href);
				var loginUri = videoCalls.getBaseUrl() + "/portal/skype/call/login";
				var $control = $(".mssfbControl");
				if ($control.length > 0) {
					// in user profile edit page 
					if (globalVideoCalls) {
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
										var loginWindow = authRedirectWindow("Skype for Business Login", settings.clientId, loginUri, "https://webdir.online.lync.com");
										var loginTokenCallback = function(token) {
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
												  	localStorage.setItem("mssfb_token_hash", token.hash_line);
													} else {
													  // Sorry! No Web Storage support..
														log("Error saving access token: local storage not supported.");
													}
												  delete globalVideoCalls.mssfb.loginToken;
												  location.hash = prevHash;
												  process.resolve();
												});
												appInitializer.fail(function(err) {
													log("Login error: " + JSON.stringify(err));
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
												  delete globalVideoCalls.mssfb.loginToken;
												  location.hash = prevHash;
												  process.reject();
												});
											} catch(e) {
												log("Error parsing even message", e);
											}
											return process.promise();
										};
										globalVideoCalls.mssfb.loginToken = loginTokenCallback;
										$settings.dialog( "close" );
					        },
					        "Cancel": function() {
					        	$settings.dialog( "close" );
					        }
					      }
					    });
						});
					} else {
						log("Error initializing MSSFB settings control: eXo.videoCalls not defined");
						$control.hide();
					}
				} else if (false && window.location.pathname.startsWith("/portal/")) {
					// TODO this else-block disabled for first release 
					// we somewhere else in the portal, try login using saved token
					if (typeof(Storage) !== "undefined") {
						var savedToken = localStorage.getItem("mssfb_token_hash");
						if (savedToken) {
							location.hash = savedToken; 
							var appInitializer = provider.application(loginUri);
							appInitializer.done(function(api, app) {
								// TODO re-save token?
							  log("Login OK (saved), app created OK, token: " + location.hash);
							});
							appInitializer.fail(function(err) {
								log("Login (saved) error: " + JSON.stringify(err));
								localStorage.removeItem("mssfb_token_hash");
							});
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
				// XXX workaround to load CSS until gatein-resources.xml's portlet-skin will work as expected
				// for Dynamic Containers
				videoCalls.loadStyle("/skype/skin/mssfb.css");
			} catch(e) {
				log("Error loading Skype Call styles (for SfB).", e);
			}
		});

		return provider;
	} else {
		log("WARN: videoCalls not given and eXo.videoCalls not defined. Skype provider registration skipped.");
	}
})($, typeof videoCalls != "undefined" ? videoCalls : null );
