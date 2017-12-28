/**
 * Skype provider module for Web Conferencing. This script will be used to add a provider to Web Conferencing module and then
 * handle calls for portal user/groups.
 */
(function($, webConferencing) {
	"use strict";

	var globalWebConferencing = typeof eXo != "undefined" && eXo && eXo.webConferencing ? eXo.webConferencing : null;
	
	// Use webConferencing from global eXo namespace (for non AMD uses)
	if (!webConferencing && globalWebConferencing) {
		webConferencing = globalWebConferencing;
	}

	if (webConferencing) {

	// Start with default logger, later in configure() we'll get it for the provider.
		// We know it's skype here, but mark with asterisk as not yet configured.
		var log = webConferencing.getLog("skype");
		//log.trace("> Loading at " + location.origin + location.pathname);

		function SkypeProvider() {
			var NON_WHITESPACE_PATTERN = /\s+/;
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
				return "Call"; // TODO i18n
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
					var currentUserSkype = webConferencing.imAccount(context.currentUser, "skype");
					if (currentUserSkype) {
						context.currentUserSkype = currentUserSkype; 
						context.details().done(function(target) { // users, convName, convTitle
							var rndText = Math.floor((Math.random() * 1000000) + 1);
							var linkId = "SkypeCall-" + target.id + "-" + rndText;
							// TODO i18n for title
							var ims = [];
							var wrongUsers = [];
							var addParticipant = function(user) {
								var uskype = webConferencing.imAccount(user, "skype");
								if (uskype && uskype.id != context.currentUserSkype.id) {
									// extra check for valid skype account: it should not contain whitespaces
									if (uskype.id && uskype.id.search(NON_WHITESPACE_PATTERN) < 0) {
										// this is a regular Skype, it cannot call business users
										ims.push(uskype.id);											
									} else {
										wrongUsers.push(user);
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
							if (ims.length > 0) {
								var userIMs = ims.join(";");
								// use Skype URI for regular Skype user
								var link = "skype:" + userIMs + "?call&amp;video=true";
								if (ims.length > 2) {
									link += "&amp;topic=" + encodeURIComponent(target.title);
								}
								var $button = $("<a id='" + linkId + "' title='" + target.title + "' href='" + link
											+ "' class='skypeCallAction'>"
											+ "<i class='uiIconSkypeCall uiIconLightGray'></i>"
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
										log.warn(title, message);
										webConferencing.noticeWarn(title, message);
									}
								});
								button.resolve($button);
							} else {
								var msg = "No " + self.getTitle() + " users found for " + target.id;
								log.debug(msg);
								button.reject(msg);
							}
						}).fail(function(err) {
							log.error("Failed to get context details", err);
							button.reject("Error getting context details for " + self.getTitle() + ": " + err);
						});
					} else {
						var msg = "Not Skype user " + context.currentUser.id;
						log.debug(msg);
						button.reject(msg);
					}
				} else {
					var msg = "Not configured or empty context for " + self.getTitle();
					log.error(msg);
					button.reject(msg);
				}
				return button.promise();
			}
		}

		var provider = new SkypeProvider();

		// Add Skype provider into webConferencing object of global eXo namespace (for non AMD uses)
		if (globalWebConferencing) {
			globalWebConferencing.skype = provider;
		} else {
			log.warn("eXo.webConferencing not defined");
		}
		
		$(function() {
			try {
				// XXX workaround to load CSS until gatein-resources.xml's portlet-skin will be able to load after the Enterprise skin
				webConferencing.loadStyle("/skype/skin/skype.css");
			} catch(e) {
				log.error("Error loading Skype Call styles.", e);
			}
		});

		log.trace("< Loaded at " + location.origin + location.pathname);
		
		return provider;
	} else {
		window.console && window.console.log("WARN: webConferencing not given and eXo.webConferencing not defined. Skype provider registration skipped.");
	}
})($, typeof webConferencing != "undefined" ? webConferencing : null );
