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
			var NON_WHITESPACE_PATTERN = /\s+/g;
			var self = this;
			var settings, currentKey;
			
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
			};

			this.isConfigured = function() {
				return settings != null;
			};

			this.callButton = function(context) {
				var button = $.Deferred();
				if (settings && context && context.currentUser) {
					var currentUserSkype = videoCalls.imAccount(context.currentUser, "skype");
					if (currentUserSkype) {
						context.currentUserSkype = currentUserSkype; 
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
									var uskype = videoCalls.imAccount(u, "skype");
									if (uskype && uskype.id != context.currentUserSkype.id) {
										// extra check for valid skype account: it should not contain whitespaces
										if (uskype.id && uskype.id.search(NON_WHITESPACE_PATTERN) < 0) {
											// this is a regular Skype, it cannot call business users
											ims.push(uskype.id);											
										} else {
											wrongUsers.push(u);
										}
									} // else, skip this user
								}
							}
							if (ims.length > 0) {
								var userIMs = ims.join(";");
								// use Skype URI for regular Skype user
								var link = "skype:" + userIMs + "?call&amp;video=true";
								var $button = $("<a id='" + linkId + "' title='" + title + "' href='" + link
											+ "' class='skypeCallAction'>"
											+ "<i class='uiIconSkypeCall uiIconForum uiIconLightGray'></i>"
											+ "<span class='callTitle'>" + self.getCallTitle() + "</span></a>");
								setTimeout(function() {
									if (!$button.hasClass("btn")) {
										// in dropdown show longer description
										$button.find(".callTitle").text(self.getTitle() + " " + self.getCallTitle());
									}
								}, 1000);
								$button.click(function() {
									if (wrongUsers.length > 0) {
										// inform the caller
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
										var message = "Following user " + s + " " + have + " wrong Skype account: " + 
											userNames + ". " + who + " not added to the call.";
										log(title, message);
										videoCalls.showWarn(title, message);
									}
								});
								button.resolve($button);
							} else {
								button.reject("No " + self.getTitle() + " users found");
							}
						});
					} else {
						button.reject("Not Skype user");
					}
				} else {
					button.reject("Not configured or empty context for " + self.getTitle());
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
