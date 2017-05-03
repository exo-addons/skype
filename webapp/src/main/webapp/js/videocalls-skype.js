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
			var self = this;
			var settings, currentKey;

			var imAccount = function(user, type) {
				var ims = user.imAccounts[type];
				if (ims && ims.length > 0) {
					// TODO work with multiple IMs of same type
					return ims[0]; 
				} else {
					return null;
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

			this.isSkypeUser = function(user) {
				return user && (user.imAccounts.skype || user.imAccounts.mssfb);
			};

			this.configure = function(skypeEnv) {
				settings = skypeEnv;
				// TODO do some validation of given settings?
				// Skype Configuration: apiKey for SDK, apiKeyCC for SDK+UI
			};

			this.isConfigured = function() {
				return settings != null;
			};

			this.callButton = function(context) {
				var button = $.Deferred();
				if (settings && context && context.currentUser) {
					context.currentUserSkype = imAccount(context.currentUser, "skype");
					var participants = $.Deferred();
					var rndText = Math.floor((Math.random() * 1000000) + 1);
					if (context.spaceName) {
						context.space.done(function(space) {
							var linkId = "SkypeCall-" + space.prettyName + "-" + rndText;
							var title = space.title + " meeting";
							participants.resolve(linkId, title, space.members);
						});
					} else if (context.roomName) {
						context.room.done(function(group) {
							var linkId = "SkypeCall-" + context.roomName + "-" + rndText;
							var title = context.roomName + " meeting"; // TODO define Chat/Room API
							participants.resolve(linkId, title, group.members);
						});
					} else {
						context.user.done(function(user) {
							var linkId = "SkypeCall-" + user.name + "-" + rndText;
							var title = "Call with " + context.user.title;
							participants.resolve(linkId, title, [ user ]);
						});
					}
					participants.done(function(linkId, title, users) {
						// TODO i18n for title
						var ims = [];
						for ( var uname in users) {
							if (users.hasOwnProperty(uname)) {
								var u = users[uname];
								var uskype = imAccount(u, "skype");
								if (uskype && uskype.id != context.currentUserSkype.id) {
									// this is a regular Skype, it cannot call business users
									ims.push(uskype.id);
								} // else, skip this user
							}
						}
						if (ims.length > 0) {
							var userIMs = ims.join(";");
							if (context.currentUserSkype) {
								// use Skype URI for regular Skype user
								var link = "skype:" + userIMs + "?call&amp;video=true";
								var $button = $("<a id='" + linkId + "' title='" + title + "' href='" + link
											+ "' class='skypeCallIcon'>" + self.getCallTitle() + "</a>");
								$button.click(function() {
									// TODO what else we could do here? status? fire listeners?
								});
								button.resolve($button);
							} else {
								// else, not skype user
								button.reject("Not Skype user");
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
