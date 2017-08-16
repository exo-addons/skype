/**
 * WebRTC call application (web page). This script initializes an UI of a page that will handle a particular call.
 */
if (eXo.videoCalls) {
	(function(videoCalls) {
		"use strict";
		
		/** For debug logging. */
		var objId = Math.floor((Math.random() * 1000) + 1);
		var logPrefix = "[webrtccall_" + objId + "] ";
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
		
		var mssfb = videoCalls.getProvider("webrtc");
		if (mssfb) {
			var hashLine = location.hash;
			var hasToken = /#access_token=/.test(hashLine);
			var hasError = /#error=/.test(hashLine);
			var isLogin = /\/login/.test(location.pathname);
			var isNewCall = /\/\w+\//.test(location.pathname); // need make an outgoing call
			var isP2PCall = /\/p\//.test(location.pathname); // incoming p2p call 
			var isGroupCall = /\/g\//.test(location.pathname); // incoming group call
			var isCall = isNewCall || isP2PCall || isGroupCall;
			var isClosed = false;

			function getParameterByName(name, url) {
				if (!url) {
					url = window.location.href;
				}
				name = name.replace(/[\[\]]/g, "\\$&");
				var regex = new RegExp("[?&#]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
				if (!results)
					return null;
				if (!results[2])
					return "";
				return decodeURIComponent(results[2].replace(/\+/g, " "));
			}

			function alignLoader() {
				var $throber = $("#mssfb-call-starting>.waitThrobber");
				if ($throber.length > 0) {
					var newHeight = $(window).height() - 30; // 15px for margins top/bottom
					var oldHeight = $throber.height();
					if (newHeight > 0) {
						$throber.height(newHeight);
					}
				}
			}
			
			function addToContainer($content) {
				var $container = $("div.mssfb-call-container");
				if ($container.length == 0) {
					$container = $("<div class='mssfb-call-container' style='display: none;'></div>");
					var newHeight = $(window).height() - 30; // 15px for margins top/bottom
					var oldHeight = $container.height();
					if (newHeight > 0) {
						$container.height(newHeight);
					}
					$(document.body).append($container);
				}
				$container.append($content);
				$container.show();
			}

			function decodeMessage(msg) {
				var dmsg = decodeURIComponent(msg);
				return dmsg.replace(/\+/g, " ");
			}

			function handleError() {
				$("#mssfb-call-conversation").hide();
				var $error = $("#mssfb-call-error");
				if ($error.length == 0) {
					$error = $("<div id='mssfb-call-error'></div>");
					addToContainer($error);
				}
				var hasharr = location.hash.substr(1).split("&");
				hasharr.forEach(function(hashelem) {
					var elemarr = hashelem.split("=");
					if (elemarr[0] == "error") {
						var $title = $("<h1 class='error-title'></h1>");
						$title.text(decodeMessage(elemarr[1]));
						$error.append($title);
					} else if (elemarr[0] == "error_description") {
						var $description = $("<div class='error-description'></div>");
						$description.text(decodeMessage(elemarr[1]));
						$error.append($description);
					} else {
						var $extrainfo = $("<div class='error-extrainfo'></div>");
						$extrainfo.text(decodeMessage(elemarr[0]) + ": " + decodeMessage(elemarr[1]));
						$error.append($extrainfo);
					}
				}, this);
			}

			function showError(title, message) {
				$("#mssfb-call-conversation, #mssfb-call-starting").hide();
				var $error = $("#mssfb-call-error");
				if ($error.length == 0) {
					$error = $("<div id='mssfb-call-error'></div>");
					addToContainer($error);
				}
				var $title = $("<h1 class='error-title'></h1>");
				$title.text(title);
				$error.append($title);
				var $description = $("<div class='error-description'></div>");
				$description.text(message);
				$error.append($description);
			}
			
			function showStarted(message) {
				var $starting = $("#mssfb-call-starting");
				$starting.empty();
				var $info = $(".startInfo");
				if ($info.length == 0) {
					$info = $("<div class='startInfo'></div>");
					$starting.append($info);
				}
				$info.text(message);
			}

			if (isLogin) {
				// FYI it's what WebSDK calls an "empty page"
				log(">> MSSFB login: " + mssfb.tokenHashInfo(hashLine));
				$(function() {
					alignLoader();
				});
				var parent = window.opener ? window.opener : (window.parent ? window.parent : null);
				if (hasToken) {
					// FYI we assume expiration time in seconds
					var expiresIn;
					try {
						expiresIn = parseInt(getParameterByName("expires_in", hashLine));
					} catch(e) {
						log("Error parsing token expiration time: " + e);
						expiresIn = 0;
					}
					var token = {
						"access_token" : getParameterByName("access_token", hashLine),
						"token_type" : getParameterByName("token_type", hashLine),
						"session_state" : getParameterByName("session_state", hashLine),
						"hash_line" : hashLine,
						"expires_in" : expiresIn,
						"created" : Math.floor(new Date().getTime()/1000)
					};
					// FYI window.opener.eXo.videoCalls.mssfb.loginToken will exist only within provider.init() execution and short time
					// thus this if-block should not execute for call authentication
					if (parent && parent.eXo && parent.eXo.videoCalls && parent.eXo.videoCalls.mssfb) {
						//var parentUri = parent.location.href;
						//log(">>>> MSSFB login opener: " + parentUri);
						// **** TODO experiments with ADSL to obtain auth token for SDK calls later
						/*var settings = {
									clientId : clientId,
									cacheLocation: "localStorage"
								};
						var msOnlineContext = new AuthenticationContext(settings);
						msOnlineContext.login();
						msOnlineContext.acquireToken("https://login.microsoftonline.com/common", function(res) {
		        	log("msOnlineContext.acquireTokenSilentAsync: " + JSON.stringify(res));
		        });
						var winGraphContext = new AuthenticationContext(settings);
						winGraphContext.acquireToken("https://graph.windows.net", function(res) {
		        	log("winGraphContext.acquireTokenSilentAsync: " + JSON.stringify(res));
		        });*/
						//
						
						if (parent.eXo.videoCalls.mssfb.loginToken) {
							log(">>> use parent.eXo.videoCalls.mssfb.loginToken()");
							parent.eXo.videoCalls.mssfb.loginToken(token).always(function() {
								showStarted("Successfully authorized in " + mssfb.getTitle() + " account."); // TODO is it correct sentense?
								setTimeout(function() {
									window.close();
								}, 2500);
							});	
						} else {
							log("<<< WARN: parent.eXo.videoCalls.mssfb.loginToken() not found");
						}
					} else {
						log("<<< ERROR: login has no opener or not initialized for callback token");
					}
				}
				if (hasError) {
					log("MSSFB login error: " + location.hash);
					handleError();
				}
				log("<< MSSFB login");
			} else {
				$(function() {
					alignLoader();
					var clientId = mssfb.getClientId();
					if (isCall) {
						//log(">> MSSFB call: " + location.origin + location.pathname);
						var pageCallId;
						var ciIndex = location.pathname.indexOf("call/") + 5;
						if (ciIndex > 5 && location.pathname.length > ciIndex) {
							pageCallId = decodeURIComponent(location.pathname.substring(ciIndex));
						} else {
							pageCallId = "???" + location.pathname;
						}
						// it's call window, user may be already authenticated, but may be not
						if (hasToken) {
							var redirectUri = videoCalls.getBaseUrl() + "/portal/skype/call/login";
							var uiInitializer = mssfb.uiApplication(redirectUri);
							uiInitializer.done(function(api, app) {
								try {
									log(">>> SDK app created OK, user: " + app.personsAndGroupsManager.mePerson.displayName());
									var currentUserSip = app.personsAndGroupsManager.mePerson.id();
									
									$("#mssfb-call-starting").hide();
									var $convo = $("#mssfb-call-conversation");
									if ($convo.length == 0) {
										$convo = $("<div id='mssfb-call-conversation'></div>");
										addToContainer($convo);
									}
									var container = mssfb.newCallContainer($convo);
									
									log(">>> Conversation is creating in " + $convo.get(0) + " " + pageCallId);
									
									// it's a new outgoing call
									/*var outgoingConversation = function(options) {
										options.modalities = [ "Chat" ]; // , "Video"
										api.renderConversation($convo.get(0), options).then(function(conversation) {
											currentConversation = conversation;
											mssfb.logConversation(conversation);
											if (mssfbCallTitle) {
												conversation.topic(mssfbCallTitle);
											}
											// TODO in case of video error, but audio or chat success - show a hint message to an user and auto-hide it
											var callId = mssfb.getCallId(conversation);
											var registerCall = function() {
												var ownerId, ownerType;
												if (conversation.isGroupConversation()) {
													var spaceId = videoCalls.getCurrentSpaceId();
													if (spaceId != null) {
														ownerId = spaceId;
														ownerType = "space";
													} else {
														var roomTitle = videoCalls.getCurrentRoomTitle();
														if (roomTitle != null) {
															ownerId = roomTitle;
															ownerType = "chat_room";
														}
													}
												} else {
													ownerId = videoCalls.getUser().id;
													ownerType = "user";
												}
												// call creator goes first in the ID of p2p
												var participants = [];
												for (var i=0; i<conversation.participantsCount(); i++) {
													var pid = conversation.participants(i).person.id();
													participants.push(pid);
												}
												var callInfo = {
													owner : ownerId,
													ownerType : ownerType,  
													provider : mssfb.getType(),
													title : conversation.topic(),
													participants : participants.join("+")
												};
												videoCalls.registerCall(callId, callInfo).done(function(call) {
													log(">>>> MSSFB call " + callId + " registered");
												}).fail(function(err) {
													log(">>>> MSSFB call " + callId + " registration failed " + JSON.stringify(err));
												});
											};
											var unregisterCall = function() {
												videoCalls.unregisterCall(callId).done(function(call) {
													log("<<<< MSSFB call " + callId + " unregistered");
												}).fail(function(err) {
													log("<<<< MSSFB call " + callId + " unregistration failed " + JSON.stringify(err));
												});
											};
											registerCall();
											conversation.videoService.start().then(function() {
												log(">>>> MSSFB video STARTED");
											}, function(videoError) {
												// error starting videoService, cancel (by this user) also will go here
												log("<<<< Error starting MSSFB video: " + JSON.stringify(videoError));
												var finisWithError = function(error) {
													unregisterCall();
													handleError(error);
												};
												if (mssfb.isModalityUnsupported(videoError)) {
													// ok, try audio
													conversation.audioService.start().then(function() {
														log(">>>> MSSFB audio STARTED");
													}, function(audioError) {
														log("<<<< Error starting MSSFB audio: " + JSON.stringify(audioError));
														if (mssfb.isModalityUnsupported(audioError)) {
															// well, it will be chat (it should work everywhere)
															conversation.chatService.start().then(function() {
																log(">>>> MSSFB chat STARTED");
															}, function(chatError) {
																log("<<<< Error starting MSSFB chat: " + JSON.stringify(chatError));
																// we show original error
																finisWithError(videoError);
															});
														} else {
															finisWithError(videoError);
														}
													});
												} else {
													finisWithError(videoError);
												}
											});
											window.addEventListener("beforeunload", beforeunloadListener);
											window.addEventListener("unload", unloadListener);
										}, function(err) {
											// error rendering Conversation Control
											if (err.name && err.message) {
												log(">>> MSSFB conversation rendering error: " + err.name + " " + err.message, err);
												showError(err.name, err.message);
											} else {
												log(">>> MSSFB conversation rendering error: " + JSON.stringify(err));
											}
										});
									};*/
									/*if (pageCallId.startsWith("g/")) {
										// Group call
										var options = {
											conversationId : pageCallId.substring(2)
										};
										//outgoingConversation(options);
									} else if (pageCallId.startsWith("p/")) {
										// P2P call
										var participants = pageCallId.substring(2).split(";");
										var options = {
											participants : participants
										};
										//outgoingConversation(options);
									} else {*/
									// It's a call request, call ID format for it: 'target_type'/'target_id', e.g. space/product_team
									var tdelim = pageCallId.indexOf("/");
									if (tdelim > 0 && tdelim < pageCallId.length - 1) {
										var startOutgoingCall = function(details) {
											mssfb.startOutgoingCall(api, app, container, details);
										};
										var targetType = pageCallId.substring(0, tdelim);
										var targetId = pageCallId.substring(tdelim + 1);
										if (targetType == "space") {
											videoCalls.getSpaceInfo(targetId).done(function(space) {
												var details = mssfb.readTargetDetails(currentUserSip, space);
												startOutgoingCall(details);
											}).fail(function(err, status) {
												log("ERROR: Space info request failure [" + status + "] " + err.code + " " + err.message, err);
												showError("Space error", err.message);
											});
										} else if (targetType == "chat_room") {
											videoCalls.getRoomInfo(targetId).done(function(room) {
												var details = mssfb.readTargetDetails(currentUserSip, room);
												startOutgoingCall(details);
											}).fail(function(err, status) {
												log("ERROR: Room info request failure [" + status + "] " + err.code + " " + err.message, err);
												showError("Chat room error", err.message);
											});
										} else if (targetType == "user") {
											videoCalls.getUserInfo(targetId).done(function(user) {
												var details = mssfb.readTargetDetails(currentUserSip, user);
												startOutgoingCall(details);
											}).fail(function(err, status) {
												log("ERROR: User info request failure [" + status + "] " + err.code + " " + err.message, err);
												showError("User error", err.message);
											});
										} else {
											log("ERROR: unsupported target type in call ID: " + pageCallId);
										}
									} else {
										log("ERROR: wrong call ID: " + pageCallId);
									}
									//}
								} catch (err) {
									log(">>> MSSFB call error:", err);
									showError("Call Error", err);
								}
							});
							uiInitializer.fail(function(err) {
								// TODO we have an error, check if it's auth problem, then force to login
								log(">>> MSSFB app error: " + err);
								showError("Application Error", err);
							});
						}
						if (hasError) {
							log("<<< MSSFB call error: " + location.hash); // show fill hash, it contains an error
							handleError();
						}
						log("<< MSSFB call");
					} else {
						log(">> MSSFB default page " + location.origin + location.pathname);
						var hasIdToken = /#id_token=/.test(hashLine);
						if (hasIdToken && location.hash.indexOf("admin_consent=True") >= 0) {
							log(">>> MSSFB admin consent: " + mssfb.tokenHashInfo(hashLine));
							var $root = $("#mssfb-call-root");
							if ($root.length == 0) {
								$root = $("<div id='mssfb-call-root'></div>");
								addToContainer($root);
							}
							var $title = $("<h1 class='consent-success'></h1>");
							$title.text("Success");
							$root.append($title);
							var $description = $("<h3 class='consent-description'></h3>");
							$description.text("Successfully granted app with Admin Consent");
							$root.append($description);
							var hasharr = location.hash.substr(1).split("&");
							hasharr.forEach(function(hashelem) {
								var elemarr = hashelem.split("=");
								var $info = $("<div class='consent-info'></div>");
								$info.text(decodeMessage(elemarr[0]) + ": " + decodeMessage(elemarr[1]));
								$root.append($info);
							}, this);
							addToContainer($("<p><a href='/portal'>Home</a></p>"));
						}
						if (hasToken) {
							log(">>> MSSFB token: " + mssfb.tokenHashInfo(hashLine));
							var $root = $("#mssfb-call-root");
							if ($root.length == 0) {
								$root = $("<div id='mssfb-call-root'></div>");
								addToContainer($root);
							}
							$root.text("Skype Calls default page. Please go to Portal Home and start a call from there.");
							addToContainer($("<div><a href='/portal'>Home</a></div>"));
						}
						if (hasError) {
							log("<<< MSSFB error: " + location.hash);
							handleError();
						}
						log("<< MSSFB default page");
					}
				});
			}
		} else {
			console.log("MSSFB provider not found for mssfb-call.js");
		}
		log("< Loaded at " + location.origin + location.pathname + " -- " + new Date().toLocaleString());
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for mssfb-call.js");
}
