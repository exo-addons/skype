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

			this.application = function(redirectUri) {
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
							app.signInManager.signIn({
								"client_id" : settings.clientId,
								"origins" : settings.origins,
								"cors" : true,
								"redirect_uri" : redirectUri,
								"version" : settings.version
							// Necessary for troubleshooting requests; identifies your application in our telemetry
							}).then(function() {
								log("Skype signed in as", app.personsAndGroupsManager.mePerson.displayName());
								appInstance = app;
								initializer.resolve(api, app);
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
								uiAppInstance = app;
								initializer.resolve(api, app);
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
					context.currentUserSFB = videoCalls.imAccount(context.currentUser, "mssfb");
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
								if (context.currentUserSFB) {
									if (ubusiness && ubusiness.id != context.currentUserSFB.id) {
										ims.push(encodeURIComponent(ubusiness.id));
									}
									// else if (uskype) {
									// ims.push(uskype.id);
									//									}
								} 
								//else if (uskype && uskype.id != context.currentUserSkype.id) {
								//	// this is a regular Skype user, business users may call it (if allowed by admin)
								//	ims.push(uskype.id);
								//} 
								// else, skip this user
							}
						}
						if (ims.length > 0) {
							var userIMs = ims.join(";");
							if (context.currentUserSFB) {
								var $button = $("<a id='" + linkId + "' title='" + title
											+ "' href='javascript:void(0);' class='mssfbCallIcon'>" + self.getCallTitle() + "</a>");
								$button.click(function() {
									// TODO check if such window isn't already open by this app
									var callUri = videoCalls.getBaseUrl() + "/portal/skype/call/_" + userIMs;
									var loginUri = "https://login.microsoftonline.com/common/oauth2/authorize?response_type=token&client_id="
																		+ settings.clientId
																		+ "&redirect_uri="
																		+ encodeURIComponent(callUri)
																		+ "&resource="
																		+ encodeURIComponent("https://webdir.online.lync.com");
									log("SfB login/call: " + loginUri);
									var callWindow = videoCalls.showCallPopup(loginUri, title);
								});
								button.resolve($button);
							} else {
								// else, not skype user
								button.reject("Not SfB user");
							}
						} else {
							// else, no user(s) found
							button.reject("No users found");
						}
					});
				} else {
					button.reject("Not configured or empty context");
				}
				return button.promise();
			};
			
			this.initUser = function() {
				// TODO init user profile UI control
				var $control = $(".uiMssfbControl");
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
