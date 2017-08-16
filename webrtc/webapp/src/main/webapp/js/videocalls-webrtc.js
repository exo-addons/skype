/**
 * WebRTC provider module for Video Calls. This script will be used to add a provider to Video Calls module and then
 * handle calls for portal user/groups.
 */
(function($, videoCalls) {
	"use strict";

	/** For debug logging. */
	var objId = Math.floor((Math.random() * 1000) + 1);
	var logPrefix = "[webrtc_" + objId + "] ";
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

	var globalVideoCalls = typeof eXo != "undefined" && eXo && eXo.videoCalls ? eXo.videoCalls : null;
	
	// Use videoCalls from global eXo namespace (for non AMD uses)
	if (!videoCalls && globalVideoCalls) {
		videoCalls = globalVideoCalls;
	}

	if (videoCalls) {

		function WebrtcProvider() {
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
				if (settings) {
					return settings.callTitle;
				}
			};

			this.configure = function(theSettings) {
				settings = theSettings;
			};

			this.isConfigured = function() {
				return settings != null;
			};

			this.callButton = function(context) {
				var button = $.Deferred();
				if (settings && context && context.currentUser) {
					// TODO do WebRTC call here
					
					
					
					////////
					var currentUserSkype = videoCalls.imAccount(context.currentUser, "webrtc");
					if (currentUserSkype) {
						context.currentUserSkype = currentUserSkype; 
						context.details().done(function(target) { // users, convName, convTitle
							var rndText = Math.floor((Math.random() * 1000000) + 1);
							var linkId = "WebrtcCall-" + target.id + "-" + rndText;
							// TODO i18n for title
							var ims = [];
							var wrongUsers = [];
							var addParticipant = function(user) {
								var uskype = videoCalls.imAccount(user, "webrtc");
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
											+ "' class='webrtcCallAction'>"
											+ "<i class='uiIconWebrtcCall uiIconForum uiIconLightGray'></i>"
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
						}).fail(function(err) {
							button.reject("Error getting participants for " + self.getTitle() + ": " + err);
						});;
					} else {
						button.reject("Not Skype user");
					}
				} else {
					button.reject("Not configured or empty context for " + self.getTitle());
				}
				return button.promise();
			}
		}

		var provider = new WebrtcProvider();

		// Add Skype provider into videoCalls object of global eXo namespace (for non AMD uses)
		if (globalVideoCalls) {
			globalVideoCalls.skype = provider;
		} else {
			log("eXo.videoCalls not defined");
		}
		
		$(function() {
			try {
				// XXX workaround to load CSS until gatein-resources.xml's portlet-skin will be able to load after the Enterprise skin
				videoCalls.loadStyle("/webrtc/skin/webrtc.css");
			} catch(e) {
				log("Error loading WebRTC Call styles.", e);
			}
		});

		log("< Loaded at " + location.origin + location.pathname + " -- " + new Date().toLocaleString());
		
		return provider;
	} else {
		log("WARN: videoCalls not given and eXo.videoCalls not defined. WebRTC provider registration skipped.");
	}
})($, typeof videoCalls != "undefined" ? videoCalls : null );
