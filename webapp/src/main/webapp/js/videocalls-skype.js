/**
 * Skype provider for Video Calls app. This script should add a provider to Video Calls module and handle calls for
 * portal user/groups.
 */
(function($, videoCalls, skypeWeb, skypeURI) {

	function isSkypeUser(user) {
		return user.imAccounts.skype || user.imAccounts["ms-sfb"];
	}

	function SkypeProvider() {

		var settings, currentKey;

		var appInstance, uiAppInstance;

		/** TODO Deprecated */
		var initSDK = function() {
			// Skype Configuration: apiKey for SDK, apiKeyCC for SDK+UI
			// config = {
			// version : settings.version,
			// apiKey : settings.apiKey,
			// apiKeyCC : settings.apiKeyCC
			// };
			currentKey = settings.apiKey;

			var user = videoCalls.getUser();
			var sessionId = user.name + "_session" + Math.floor((Math.random() * 1000000) + 1);
			Skype.initialize({
				version : settings.version,
				apiKey : settings.apiKey,
				correlationIds : {
					sessionId : sessionId
				// Necessary for troubleshooting requests, should be unique per session
				}
			}, function(api) {
				var app = new api.application();
				// SignIn SfB Online: the SDK will get its own access token
				app.signInManager.signIn({
					client_id : settings.clientId,
					cors : true,
					redirect_uri : settings.redirectUri,
					origins : settings.origins,
					version : settings.version
				// Necessary for troubleshooting requests; identifies your application in our telemetry
				}, function() {
					console.log("Skype signed in as", app.personsAndGroupsManager.mePerson.displayName());
				}, function(err) {
					console.log("Cannot sign in Skype", err);
				});

				// whenever client.state changes, display its value
				app.signInManager.state.changed(function(state) {
					// TODO
					console.log("State change:" + JSON.stringify(state));
				});
			}, function(err) {
				console.log("Cannot load the SDK.", err);
			});
		};

		var getGroupParticipants = function(group, useBusiness) {
			var participants = [];
			for ( var uname in group.members) {
				if (group.members.hasOwnProperty(uname)) {
					var u = group.members[uname];
					var uskype = u.imAccounts.skype;
					var ubusiness = u.imAccounts["ms-sfb"];
					if (useBusiness) {
						if (ubusiness) {
							participants.push(encodeURIComponent(ubusiness.id));
						} else if (uskype) {
							participants.push(uskype.id);
						}
					} else if (uskype) {
						// current is regular Skype, it cannot call business users
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
				participants = getGroupParticipants(context.space, context.currentUserSFB);
			} else if (context.chat) {
				// it's Chat room call
				participants = getGroupParticipants(context.chat.room, context.currentUserSFB);
			} else {
				// otherwise assume it's one-on-one call
				participants = [];
				var uskype = context.user.imAccounts.skype;
				var ubusiness = context.user.imAccounts["ms-sfb"];
				if (context.currentUserSFB) {
					if (ubusiness) {
						participants.push(encodeURIComponent(context.currentUserSFB.id));
						participants.push(encodeURIComponent(ubusiness.id));
					} else if (uskype) {
						participants.push(context.currentUserSFB.id);
						// Business user can call regular users
						participants.push(uskype.id);
					}
				} else if (uskype) {
					// current is regular Skype, it cannot call business users
					// participants.push(context.currentUserSkype.id); // don't need this for Skype URI
					participants.push(uskype.id);
				}
			}
			return participants;
		};

		this.getName = function() {
			if (settings) {
				return settings.name;
			}
		}

		this.getTitle = function() {
			if (settings) {
				return settings.title;
			}
		}

		this.getCallTitle = function() {
			if (settings) {
				return settings.callTitle;
			}
		}

		this.configure = function(skypeEnv) {
			settings = skypeEnv;
			// TODO do some validation of given settings?
			// Skype Configuration: apiKey for SDK, apiKeyCC for SDK+UI
			// initSDK();
		};

		this.isConfigured = function() {
			return settings != null;
		};

		this.application = function() {
			var initializer = $.Deferred();
			if (settings) {
				if (appInstance) {
					initializer.resolve(appInstance);
				} else {
					var user = videoCalls.getUser();
					var sessionId = user.name + "_session" + Math.floor((Math.random() * 1000000) + 1);
					Skype.initialize({
						version : settings.version,
						apiKey : settings.apiKey,
						correlationIds : {
							sessionId : sessionId
						// Necessary for troubleshooting requests, should be unique per session
						}
					}, function(api) {
						var app = new api.application();
						// SignIn SfB Online: the SDK will get its own access token
						app.signInManager.signIn({
							client_id : settings.clientId,
							cors : true,
							redirect_uri : settings.redirectUri,
							origins : settings.origins,
							version : settings.version
						// Necessary for troubleshooting requests; identifies your application in our telemetry
						}, function() {
							console.log("Skype signed in as", app.personsAndGroupsManager.mePerson.displayName());
							appInstance = app;
							initializer.resolve(app);
						}, function(err) {
							console.log("Cannot sign in Skype", err);
							initializer.reject(err);
						});

						// whenever client.state changes, display its value
						app.signInManager.state.changed(function(state) {
							// TODO
							console.log("State change:" + JSON.stringify(state));
						});
					}, function(err) {
						console.log("Cannot load Skype SDK.", err);
						initializer.reject(err);
					});
				}
			} else {
				initializer.reject("Skype settings not found");
			}
			return initializer.resolve();
		};

		this.uiApplication = function() {
			var initializer = $.Deferred();
			if (settings) {
				if (uiAppInstance) {
					initializer.resolve(uiAppInstance);
				} else {
					var user = videoCalls.getUser();
					var sessionId = user.name + "_uisession" + Math.floor((Math.random() * 1000000) + 1);
					Skype.initialize({
						version : settings.version,
						apiKey : settings.apiKeyCC,
						correlationIds : {
							sessionId : sessionId
						// Necessary for troubleshooting requests, should be unique per session
						}
					}, function(api) {
						var app = api.UIApplicationInstance;
						// SignIn SfB Online: the SDK will get its own access token
						app.signInManager.signIn({
							client_id : settings.clientId,
							cors : true,
							redirect_uri : settings.redirectUri,
							origins : settings.origins,
							version : settings.version
						// Necessary for troubleshooting requests; identifies your application in our telemetry
						}, function() {
							console.log("SkypeCC signed in as", app.personsAndGroupsManager.mePerson.displayName());
							uiAppInstance = app;
							initializer.resolve(app);
						}, function(err) {
							console.log("Cannot sign in SkypeCC", err);
							initializer.reject(err);
						});

						// whenever client.state changes, display its value
						app.signInManager.state.changed(function(state) {
							// TODO
							console.log("StateCC change:" + JSON.stringify(state));
						});
					}, function(err) {
						console.log("Cannot load SkypeCC SDK.", err);
						initializer.reject(err);
					});
				}
			} else {
				initializer.reject("Skype settings not found");
			}
			return initializer.resolve();
		};

		this.callButton = function(context) {
			var $button;
			if (context && context.currentUser) {
				context.currentUserSkype = context.currentUser.imAccounts.skype;
				context.currentUserSFB = context.currentUser.imAccounts["ms-sfb"];
				var participants = participants(context);
				var isGroupCall;
				var linkId, title; // TODO i18n for title
				var rndText = Math.floor((Math.random() * 1000000) + 1);
				if (context.space) {
					linkId = "SkypeCall-" + context.space.shortName + "-" + rndText;
					title = context.space.title + " space";
					isGroupCall = true;
				} else if (context.chat && context.chat.room) {
					linkId = "SkypeCall-" + context.space.shortName + "-" + rndText;
					title = context.chat.room.title + " room"; // TODO define Chat/Room API
					isGroupCall = true;
				} else {
					linkId = "SkypeCall-" + participants.join("-") + "-" + rndText;
					titie = "Call with " + context.user.title;
					isGroupCall = false;
				}
				if (participants.length > 0) {
					if (context.currentUserSFB) {
						// TODO use Skype WebSDK for Business users
						// var useBusiness = context.currentUserSFB; // && (isIOS || isAndroid)
						var userIMs = participants.join(";");
						// TODO

					} else if (context.currentUserSkype) {
						// use Skype URI for regular Skype user
						// $button = $("<div id='"
						// + linkId
						// + "' style='display: none;' class='startCallButton'><a class='actionIcon startCallAction userCall'
						// title='Call with "
						// + context.user.title
						// + "' style='margin-left:5px;'>"
						// + "<img src='http://www.skypeassets.com/i/scom/images/skype-buttons/callbutton_24px.png' alt='Skype call'
						// role='Button' style='border: 0px; margin: 2px;'>"
						// + "</a></div>");
						var userIMs = participants.join(";");
						var link = "skype:" + userIMs + "?call&amp;video=true";
						$button = $("<a id='" + linkId + "' title='" + title + "' href='" + link
									+ "'><i class='skypeCallIcon'></i>" + this.getCallTitle() + "</a>");
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

	// only if user has Skype IMs
	$(function() {
		var user = videoCalls.getUser();
		if (isSkypeUser(user)) {
			if (videoCallsEnv && videoCallsEnv.skype) {
				provider.configure(videoCallsEnv.skype);
				videoCalls.addProvider(provider);
			}
		}
	});

	return provider;
});
