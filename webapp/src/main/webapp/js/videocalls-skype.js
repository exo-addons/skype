/**
 * Skype provider module for Video Calls. This script will be used to add a provider to Video Calls module and then
 * handle calls for portal user/groups.
 */
(function($, videoCalls) {
	"use strict";

	/** For debug logging. */
	var objId = Math.floor((Math.random() * 1000) + 1);
	var logPrefix = "[skype_" + objId + "] ";
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

		function SkypeProvider() {
			var settings, currentKey;
			var appInstance, uiAppInstance;

			var imAccount = function(user, type) {
				var ims = user.imAccounts[type];
				if (ims && ims.length > 0) {
					// TODO work with multiple IMs of same type
					return ims[0]; 
				} else {
					return null;
				}
			};
			
			var getGroupParticipants = function(group, context) {
				var participants = [];
				for ( var uname in group.members) {
					if (group.members.hasOwnProperty(uname)) {
						var u = group.members[uname];
						var uskype = imAccount(u, "skype");
						var ubusiness = imAccount(u, "mssfb");
						if (context.currentUserSFB) {
							if (ubusiness && ubusiness.id != context.currentUserSFB.id) {
								participants.push(encodeURIComponent(ubusiness.id));
							} else if (uskype) {
								participants.push(uskype.id);
							}
						} else if (uskype) {
							// this is a regular Skype, it cannot call business users
							participants.push(uskype.id);
						} // else, skip this user
					}
				}
				return participants;
			};

			var participants = function(context) {
				var participants;
				if (context.space) {
					// it's Space's group call
					participants = getGroupParticipants(context.space, context);
				} else if (context.chat) {
					// it's Chat room call
					participants = getGroupParticipants(context.chat.room, context);
				} else {
					// otherwise assume it's one-on-one call
					participants = [];
					var uskype = imAccount(context.user, "skype");
					var ubusiness = imAccount(context.user, "mssfb");
					if (context.currentUserSFB) {
						if (ubusiness && ubusiness.id != context.currentUserSFB.id) {
							// participants.push(encodeURIComponent(context.currentUserSFB.id));
							participants.push(encodeURIComponent(ubusiness.id));
						} else if (uskype) {
							// participants.push(context.currentUserSFB.id);
							// Business user can call regular users
							participants.push(uskype.id);
						}
					} else if (uskype) {
						if (context.currentUserSkype && uskype.id != context.currentUserSkype.id) {
							// current is regular Skype, it cannot call business users
							// participants.push(context.currentUserSkype.id); // don't need add a self
							participants.push(uskype.id);
						}
					}
				}
				return participants;
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

			this.isSkypeUser = function(user) {
				return user && (user.imAccounts.skype || user.imAccounts.mssfb);
			};

			this.configure = function(skypeEnv) {
				settings = skypeEnv;
				// TODO do some validation of given settings?
				// Skype Configuration: apiKey for SDK, apiKeyCC for SDK+UI
				// initSDK();
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
				var $button;
				if (settings && context && context.currentUser) {
					context.currentUserSkype = imAccount(context.currentUser, "skype");
					context.currentUserSFB = imAccount(context.currentUser, "mssfb");
					var callParts = participants(context);
					var isGroupCall;
					var linkId, title; // TODO i18n for title
					var rndText = Math.floor((Math.random() * 1000000) + 1);
					if (context.space) {
						linkId = "SkypeCall-" + context.space.prettyName + "-" + rndText;
						title = context.space.title + " meeting";
						isGroupCall = true;
					} else if (context.chat && context.chat.room) {
						linkId = "SkypeCall-" + context.space.prettyName + "-" + rndText;
						title = context.chat.room.title + " meeting"; // TODO define Chat/Room API
						isGroupCall = true;
					} else {
						linkId = "SkypeCall-" + callParts.join("-") + "-" + rndText;
						titie = "Call with " + context.user.title;
						isGroupCall = false;
					}
					if (callParts.length > 0) {
						if (context.currentUserSFB) {
							// TODO use Skype WebSDK for Business users
							// var useBusiness = context.currentUserSFB; // && (isIOS || isAndroid)
							var userIMs = callParts.join(";");
							$button = $("<a id='" + linkId + "' title='" + title
										+ "' href='javascript:void(0);' class='sfbCallIcon'>" + this.getCallTitle() + "</a>");
							$button.click(function() {
								// TODO check if such window isn't already open by this app
								var callUri = videoCalls.getBaseUrl() + "/portal/skype/call/_" + userIMs;
								//var callWindow = window.open(callUri);
								var loginUri = "https://login.microsoftonline.com/common/oauth2/authorize?response_type=token&client_id="
																	+ settings.clientId
																	+ "&redirect_uri="
																	+ encodeURIComponent(callUri)
																	+ "&resource="
																	+ encodeURIComponent("https://webdir.online.lync.com");
								log("Skype login/call: " + loginUri);
								var callWindow = window.open(loginUri);
							});
						} else if (context.currentUserSkype) {
							// use Skype URI for regular Skype user
							var userIMs = callParts.join(";");
							var link = "skype:" + userIMs + "?call&amp;video=true";
							$button = $("<a id='" + linkId + "' title='" + title + "' href='" + link
										+ "' class='skypeCallIcon'>" + this.getCallTitle() + "</a>");
							$button.click(function() {
								// TODO what else we could do here? status? fire listeners?
							});
						} // else, not skype user
					}
				}
				return $button;
			}
		}

		var provider = new SkypeProvider();

		// Add Skype provider into videoCalls object of global eXo namespace (for non AMD uses)
		if (globalVideoCalls) {
			globalVideoCalls.skype = provider;
		} else {
			log("eXo.videoCalls not defined");
		}
		
		$(function() {
			try {
				// XXX workaround to load CSS until gatein-resources.xml's portlet-skin will work as expected
				// for Dynamic Containers
				videoCalls.loadStyle("/skype/skin/skype.css");
			} catch(e) {
				log("Error loading Skype Call styles.", e);
			}
		});

		return provider;
	} else {
		log("WARN: videoCalls not given and eXo.videoCalls not defined. Skype provider registration skipped.");
	}
})($, typeof videoCalls != "undefined" ? videoCalls : null );
