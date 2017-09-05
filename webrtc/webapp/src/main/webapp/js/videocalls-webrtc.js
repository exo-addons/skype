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
			var settings, currentKey, clientId;
			
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
			
			this.getClientId = function() {
				return clientId;
			};
			
			var getRandomArbitrary = function(min, max) {
			  return Math.random() * (max - min) + min;
			};
			
			this.createId = function(prefix) {
				var rnd = Math.floor(getRandomArbitrary(10000, 99998) + 1);
				return prefix + "-" + rnd;
			};

			var deleteCall = function(callId) {
				// For P2P we delete closed call
				var process = $.Deferred();
				videoCalls.deleteCall(callId).done(function() {
					log("<< Deleted " + callId + " > " + new Date().getTime());
					process.resolve();
				}).fail(function(err) {
					if (err && (err.code == "NOT_FOUND_ERROR" || (typeof(status) == "number" && status == 404))) {
						// already deleted
						log("<< Call not found " + callId);
						process.resolve();
					} else {
						log("ERROR deleting " + callId + ": " + JSON.stringify(err));
						process.reject(err);
					}
				});
				return process.promise();
			};
			this.deleteCall = deleteCall;
			
			this.callButton = function(context) {
				var button = $.Deferred();
				if (settings && context && context.currentUser) {
					// TODO do WebRTC call here
					if (!context.isGroup) {
						context.details().done(function(target) { // users, convName, convTitle
							var rndText = Math.floor((Math.random() * 1000000) + 1);
							var linkId = "WebrtcCall-" + clientId;
							var callId = "p/" + context.currentUser.id + "@" + target.id;
							var link = settings.callUri + "/" + callId;
							//var disabledClass = hasJoinedCall(targetId) ? "callDisabled" : "";
							// TODO i18n for title
							var $button = $("<a id='" + linkId + "' title='" + target.title + "'"
										+ " class='webrtcCallAction'>"
										+ "<i class='uiIconWebrtcCall uiIconForum uiIconLightGray'></i>"
										+ "<span class='callTitle'>" + self.getCallTitle() + "</span></a>");
							var longTitle = self.getTitle() + " " + self.getCallTitle();
							setTimeout(function() {
								if (!$button.hasClass("btn")) {
									// in dropdown show longer description
									$button.find(".callTitle").text(longTitle);
								}
							}, 1000);
							$button.click(function() {
								// Open a window for a new call
								var callWindow = videoCalls.showCallPopup(link, longTitle);
								// Create a call
								var callInfo = {
									owner : context.currentUser.id,
									ownerType : "user",  
									provider : self.getType(),
									title : target.title,
									participants : [context.currentUser.id, target.id].join(";") // eXo user ids separated by ';' !
								};
								videoCalls.addCall(callId, callInfo).done(function(call) {
									log(">> Added " + callId + " > " + new Date().getTime());
									// Tell the window to start the call  
									callWindow.document.title = longTitle + ": " + target.title;
									$(callWindow).on("load", function() {
										// XXX Wait 5sec for debug only - remove in production
										setTimeout(function() {
											callWindow.eXo.videoCalls.startCall(call).fail(function(err) {
												videoCalls.showError("Error starting call", err);
											});											
										}, 5);
									});
								}).fail(function(err) {
									log("ERROR adding " + callId + ": " + JSON.stringify(err));
									videoCalls.showError("Call error", err.message);
								});
							});
							button.resolve($button);
						}).fail(function(err) {
							log("Error getting context details for " + self.getTitle() + ": " + err);
							videoCalls.showWarn("Error starting a call", err.message);
						});
					} else {
						button.reject("Group calls not supported by WebRTC provider");
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
					  	$call.dialog("close");
					  },
					  "Decline": function() {
					  	process.reject("declined");
					  	$call.dialog("close");
					  }
					} 
				});
				$call.on("dialogclose", function( event, ui ) {
					if (process.state() == "pending") {
						process.reject("closed");
					}
				});
				process.notify($call);
				// Start ringing 
				// TODO use original WebRTC ringtone
				var $ring = $("<audio controls loop style='display: none;'>"
							+ "<source src='https://latest-swx.cdn.skype.com/assets/v/0.0.300/audio/m4a/call-outgoing-p1.m4a' type='audio/mpeg'>"  
							+ "Your browser does not support the audio element.</audio>");
				$(document.body).append($ring);
				var player = $ring.get(0);
				player.pause();
				//player.currentTime = 0;
				setTimeout(function () {      
					player.play();
				}, 250);
				process.always(function() {
					player.pause();
					$ring.remove();
				});
				return process.promise();
			};
			
			this.init = function(context) {
				var currentUserId = videoCalls.getUser().id;
				clientId = self.createId(currentUserId);
				var $callPopup;
				var closeCallPopup = function(callId, state) {
					if ($callPopup && $callPopup.callId && $callPopup.callId == callId) {
						if ($callPopup.is(":visible")) {
							$callPopup.dialog("close");
							$callPopup.callState = state;
						}
					}
				};
				var lockCallButton = function(callId, callerId, callerRoom) {
				};
				var unlockCallButton = function(callId, callerId, callerRoom) {
				};
				if (videoCalls.hasChatApplication()) {
					// Care about marking chat rooms for active calls
					var $chat = $("#chat-application");
					if ($chat.length > 0) {
						var $chats = $chat.find("#chats");
						if ($chats.length > 0) {
							var $users = $chat.find("#chat-users");
							// Implement Chat specific logic
							var getCallButton = function() {
								return $chat.find("#room-detail .webrtcCallAction");
							};
							lockCallButton = function(callId, callerId, callerRoom) {
								var roomId = chatApplication.targetUser;
								if (roomId == (callerRoom ? callerRoom : callerId)) {
									var $callButton = getCallButton();
									if (!$callButton.hasClass("callDisabled")) {
										$callButton.addClass("callDisabled");
									}								
								}
							};
							unlockCallButton = function(callId, callerId, callerRoom) {
								var roomId = chatApplication.targetUser;
								if (roomId == (callerRoom ? callerRoom : callerId)) {
									var $callButton = getCallButton();
									$callButton.removeClass("callDisabled");
								}
							};
						} else {
							log("Cannot find #chats element");
						} 
					} else {
						log("Chat application element not found.");
					}
				}
				videoCalls.onUserUpdate(currentUserId, function(update, status) {
					if (update.eventType == "call_state") {
						if (update.caller.type == "user") {
							log(">>> User call state updated: " + JSON.stringify(update) + " [" + status + "]");
							var callId = update.callId;
							if (update.callState == "started") {
								videoCalls.getCall(callId).done(function(call) {
									log(">>> Got registered " + callId + " > " + new Date().getTime());
									var callerId = call.owner.id;
									var callerLink = call.ownerLink;
									var callerAvatar = call.avatarLink;
									var callerMessage = call.owner.title + " is calling.";
									var callerRoom = callerId;
									call.title = call.owner.title; // for callee the call title is a caller name
									//
									var popover = acceptCallPopover(callerLink, callerAvatar, callerMessage);
									popover.progress(function($call) {
										$callPopup = $call;
										$callPopup.callId = callId;
										$callPopup.callState = update.callState;
									}); 
									popover.done(function(msg) {
										log(">>> user " + msg + " call " + callId);
										var longTitle = self.getTitle() + " " + self.getCallTitle();
										var link = settings.callUri + "/" + callId;
										var callWindow = videoCalls.showCallPopup(link, longTitle);
										// Tell the window to start the call  
										callWindow.document.title = longTitle + ": " + call.owner.title;
										$(callWindow).on("load", function() {
											callWindow.eXo.videoCalls.startCall(call).done(function(state) {
												lockCallButton(callId, callerId, callerRoom);
											}).fail(function(err) {
												videoCalls.showError("Error starting call", err);
											});
										});
									});
									popover.fail(function(err) {
										if ($callPopup.callState != "stopped") {
											log("<<< User " + err + " call " + callId + ", deleting it.");
											videoCalls.deleteCall(callId).done(function() {
												log("<<< Deleted " + callId + " > " + new Date().getLocaleString);
											}).fail(function(err) {
												log("ERROR deleting " + callId + ": " + JSON.stringify(err));
											});
										}
									});
								}).fail(function(err, status) {
									log(">>> Call info error: " + JSON.stringify(err) + " [" + status + "]");
									if (err) {
										videoCalls.showError("Incoming call error", err.message);
									} else {
										videoCalls.showError("Incoming call error", "Error read call information from the server");
									}
								});
							} else if (update.callState == "stopped") {
								// Hide accept popover for this call
								closeCallPopup(callId, update.callState);
								// Unclock the call button
								var callerId = update.callerId; // callerRoom is the same as callerId for P2P
								unlockCallButton(callId, callerId, callerId); 
							}							
						} else {
							log(">>> Group calls not supported: " + JSON.stringify(update) + " [" + status + "]");
						}
					} else if (update.eventType == "call_joined") {
						// TODO not used (not fired)
					} else if (update.eventType == "call_leaved") {
						// TODO not used (not fired)
					} else if (update.eventType == "retry") {
						log("<<< Retry for user updates [" + status + "]");
					} else {
						log("<<< Unexpected user update: " + JSON.stringify(update) + " [" + status + "]");
					}
				}, function(err) {
					// Error handler
					log(err);
				});
			};
		}

		var provider = new WebrtcProvider();

		// Add WebRTC provider into videoCalls object of global eXo namespace (for non AMD uses)
		if (globalVideoCalls) {
			globalVideoCalls.webrtc = provider;
			log("> Added eXo.videoCalls.webrtc");
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
