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
				var isoTime = " -- " + new Date().toISOString();
				if (e) {
					var logText = logPrefix + msg;
					if (typeof e.toString == "function") {
						logText += ". Error: " + e.toString();
					} else if (e.name && e.message) {
						logText += ". " + e.name + ": " + e.message;
					} else {
						logText += ". Cause: " + (typeof e == "string" ? e : JSON.stringify(e));
					}
					console.log(logText + isoTime);
					if (typeof e.stack != "undefined") {
						console.log(e.stack);
					}
				} else {
					console.log(logPrefix + msg + isoTime);
				}
			}
		};
		// log("> Loading at " + location.origin + location.pathname);
		
		var isP2PCall = /\/p\//.test(location.pathname); // incoming p2p call
		var isGroupCall = /\/g\//.test(location.pathname); // incoming group call
		//var isHost = /\?host/.test(location.search); // create new call
		var isEdge = /Edge/.test(navigator.userAgent);
		var isFirefox = /Firefox/.test(navigator.userAgent);
		var isChrome = /Chrom(e|ium)/.test(navigator.userAgent);

		function alignLoader() {
			var $throber = $("#webrtc-call-starting>.waitThrobber");
			if ($throber.length > 0) {
				var newHeight = $(window).height() - 30; // 15px for margins top/bottom
				var oldHeight = $throber.height();
				if (newHeight > 0) {
					$throber.height(newHeight);
				}
			}
		}
		
		function addToContainer($content) {
			var $container = $("div.webrtc-call-container");
			if ($container.length == 0) {
				$container = $("<div class='webrtc-call-container' style='display: none;'></div>");
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

		function showError(title, message) {
			$("#webrtc-call-conversation, #webrtc-call-title, #webrtc-call-starting").hide();
			var $error = $("#webrtc-call-error");
			if ($error.length == 0) {
				$error = $("<div id='webrtc-call-error'></div>");
				addToContainer($error);
			}

			// Append errors (for history)
			var $title = $("<h1 class='error-title'></h1>");
			$title.text(title);
			$error.append($title);
			var $description = $("<div class='error-description'></div>");
			$description.text(message);
			$error.append($description);
		}
		
		function showStarted(message) {
			var $starting = $("#webrtc-call-starting");
			$starting.empty();
			var $info = $(".startInfo");
			if ($info.length == 0) {
				$info = $("<div class='startInfo'></div>");
				$starting.append($info);
			}
			$info.text(message);
		}
		
		function objectUrl(obj) {
			if (window.URL) {
		  	return window.URL.createObjectURL(obj);
		  } else {
		  	return obj;
		  }
		}
		
		$(function() {
			alignLoader();
		});
		
		eXo.videoCalls.startCall = function(call) {
			var process = $.Deferred();
			$(function() {
				var webrtc = videoCalls.getProvider("webrtc");
				if (webrtc) {
					if (webrtc.isSupportedPlatform()) {
						log(">> WebRTC call: " + location.origin + location.pathname);
						var callId = call.id;
						var isGroup = callId.startsWith("g/");
						if (isGroup) {
							log(">> Group calls not supported by WebRTC");
							showError("Warning", "Group calls not supported by WebRTC provider");
							setTimeout(function() {
								window.close();
							}, 7000);
							process.reject("Group calls not supported by WebRTC");
						} else {
							log("Preparing call " + callId);
							var currentUserId = videoCalls.getUser().id;
							var clientId = webrtc.getClientId();
							var isOwner = currentUserId == call.owner.id;
							// Use this for avatar when no video stream available
							//var callerLink = call.ownerLink;
							//var callerAvatar = call.avatarLink;
							
							$("#webrtc-call-starting").hide();
							$("#webrtc-call-container").show();
							var $convo = $("#webrtc-call-conversation");
							var $title = $("#webrtc-call-title > h1");
							$title.text(call.title);
							
							var $videos = $convo.find("#videos");
							var $remoteVideo = $videos.find("#remote-video");
							var remoteVideo = $remoteVideo.get(0);
							var $localVideo = $videos.find("#local-video");
							var localVideo = $localVideo.get(0);
							var $miniVideo = $videos.find("#mini-video");
							var miniVideo = $miniVideo.get(0);
							
							var $controls = $convo.find("#controls");
							$controls.addClass("active");
							$controls.show(); // TODO apply show/hide on timeout 
							var $hangupButton = $controls.find("#hangup");
							
							// WebRTC connection to establish a call connection
							log("Creating RTC peer connection for " + callId);
							// TODO use configurable stun/turn server (from server-side)
							try {
								/*var pc = new RTCPeerConnection({
									iceServers: [
										{ 
											"urls": [
												"stun:stun.l.google.com:19302", 
												"stun:stun1.l.google.com:19302",
												"stun:stun2.l.google.com:19302",
												"stun:stun3.l.google.com:19302",
												"stun:stun4.l.google.com:19302"
											]
										}, {
											"urls": [
												"stun:stunserver.org",
												"stun:stun01.sipphone.com",
												"stun:stun.voiparound.com"
											]
										}
									]
								});*/
								/*{urls: 'turn:stun.l.google.com:19301?transport=udp'},
          			{urls: 'turn:stun.l.google.com:19302?transport=udp'},*/
								var rtcConfig;
								if (isEdge) {
									// XXX Edge doesn't support STUN yet? Only TURN will work.
									// https://msdn.microsoft.com/en-us/library/mt502501(v=vs.85).aspx
									rtcConfig = {
										iceServers: [] 
									};
								} else {
									rtcConfig = {
										iceServers: [ { urls: "stun:stun.l.google.com:19302" },
											{ urls: "stun:stunserver.org" } ]
									};									
								}
								var pc = new RTCPeerConnection(rtcConfig);
								var negotiation = $.Deferred();
								var connection = $.Deferred();
								
								// Play incoming ringtone for the call owner until complete negotiation
								if (isOwner) {
									var $ring = $("<audio loop autoplay style='display: none;'>" 
												+ "<source src='/webrtc/audio/echo.mp3' type='audio/mpeg'>"  
												+ "Your browser does not support the audio element.</audio>");
									$(document.body).append($ring);
									negotiation.then(function() {
										$ring.remove();
									});
								}
								
								var handleError = function(title, message) {
									showError(title, message);
									// TODO get rid of this wrapper, or do something vakuable here.
								}
								connection.fail(function(err) {
									log("ERROR starting connection for " + callId + ": " + err, err);
									handleError("Error of starting connection", err);
								});
								var sendMessage = function(message) {
									return videoCalls.toCallUpdate(callId, $.extend({
						    		"provider" : webrtc.getType(),
						    		"sender" : currentUserId,
						    		"client" : clientId,
						    		"host" : isOwner
						      }, message)).done(function() {
						      	log("<< Sent call update: " + JSON.stringify(message));
						      });
								};
								var sendHello = function() {
									// It is a first message send on the call channel by a peer, 
									// it tells that the end is ready to exchange other information (i.e. accepted the call)
									// If it will be required to change a host in future, then this message should be send
									// by a new host with '__all__' content, others should understand this and update their 
									// owner ID to this sender ID.
									return sendMessage({
						    		"hello": isOwner ? "__all__" : call.owner.id
						      }).done(function() {
						      	log("<< Published Hello to " + callId);
									}).fail(function(err) {
										log("ERROR publishing Hello to " + callId + ": " + err, err);
									});
								};
								var sendBye = function() {
									// TODO not used
									// It is a last message send on the call channel by a peer, 
									// other side should treat is as call successfully ended and no further action required (don't need delete the call)
									return sendMessage({
						    		"bye": isOwner ? "__all__" : call.owner.id
						      }).done(function() {
						      	log("<< Published Bye to " + callId);
									}).fail(function(err) {
										log("ERROR publishing Bye to " + callId + ": " + err, err);
									});
								};
								var sendOffer = function(localDescription) {
									return sendMessage({
						    		"offer": JSON.stringify(localDescription)
						      }).done(function() {
						      	log("<< Published offer to " + callId);
									}).fail(function(err) {
										log("ERROR publishing offer to " + callId + ": " + err, err);
										// TODO May retry?
										handleError("Error of sharing media offer", err);
									});
								};
								var sendAnswer = function(localDescription) {
									return sendMessage({
						    		"answer": JSON.stringify(localDescription)
						      }).done(function() {
						      	log("<< Published answer to " + callId);
									}).fail(function(err) {
										log("ERROR publishing answer to " + callId + ": " + err, err);
										handleError("Error of sharing media answer", err);
									});
								};
								var sendCandidate = function(candidate) {
									return sendMessage({
						    		// "sdpMLineIndex" : event.candidate.sdpMLineIndex,
						        // "sdpMid": event.candidate.sdpMid,
						        "candidate" : candidate
						      }).done(function() {
						      	log("<< Published candidate to " + callId);
									}).fail(function(err) {
										log("ERROR publishing candidate to " + callId + ": " + err, err);
										handleError("Error of sharing connection", err);
									});
								};
								
								// 'Hang Up' and page close actions to end call properly
								var stopping = false;
								var stopCall = function(localOnly) {
									// TODO here we also could send 'bye' message - it will work for 'Hang Up' button, 
									// but in case of page close it may not be sent to others, thus we delete the call here.
									if (!stopping) {
										stopping = true;
										// Play complete ringtone
										var $complete = $("<audio autoplay style='display: none;'>" 
													+ "<source src='/webrtc/audio/complete.mp3' type='audio/mpeg'>"  
													+ "Your browser does not support the audio element.</audio>");
										$(document.body).append($complete);
										function stopLocal() {
											try {
												pc.close();
											} catch(e) {
												log("WARN Failed to close peer connection: ", e);
											}
											window.removeEventListener("beforeunload", beforeunloadListener);
											window.removeEventListener("unload", unloadListener);
										}
										if (localOnly) {
											stopLocal();
										} else {
											//leavedCall(); // No sense to send 'leaved' for P2P, it is already should be stopped
											webrtc.deleteCall(callId).always(function() {
												stopLocal();
											});
										}									
									}
								};
								var beforeunloadListener = function(e) {
									stopCall();
								};
								var unloadListener = function(e) {
									stopCall();
								};
								window.addEventListener("beforeunload", beforeunloadListener);
								window.addEventListener("unload", unloadListener);
								var stopCallWaitClose = function(localOnly) {
									stopCall(localOnly);
									setTimeout(function() {
										window.close();
									}, 1500);
								};
								$hangupButton.click(function() {
									stopCallWaitClose();
								});
								
								// Subscribe to user calls to know if this call updated/stopped remotely
							  videoCalls.onUserUpdate(currentUserId, function(update, status) {
									if (update.eventType == "call_state") {
										if (update.caller.type == "user") {
											var callId = update.callId;
											if (update.callState == "stopped" && update.callId == callId) {
												log(">>> Call stopped remotelly: " + JSON.stringify(update) + " [" + status + "]");
												stopCallWaitClose(true);
											}							
										}
									}
								}, function(err) {
									log("ERROR User calls subscription failure: " + err, err);
								});
								
								// Add peer listeners for connection flow
								pc.onicecandidate = function (event) {
									// This will happen when browser will be ready to exchange peers setup
									log(">> onIceCandidate for " + callId + ": " + JSON.stringify(event));
									connection.then(function() {
								    if (event.candidate) {
								    	sendCandidate(event.candidate);
								    } else {
								      // else All ICE candidates have been sent. ICE gathering has finished.
								    	// TODO any action is expected here?
								    	sendCandidate({});
								    	log("<< All ICE candidates have been sent");
								    }
									});
							  };
							  var sdpConstraints = {
					  			"offerToReceiveAudio": true, 
				  				"offerToReceiveVideo": false/*,
					  			"mandatory": { 
					  				"OfferToReceiveAudio": true, 
					  				"OfferToReceiveVideo": true
					  			}*/
							  };
							  if (isEdge) {
							  	sdpConstraints = {}; // TODO in fact even undefined doesn't fit, need call without a parameter
							  }
						  	// let the 'negotiationneeded' event trigger offer generation
							  pc.onnegotiationneeded = function () {
							  	// This will be fired after adding a local media stream and browser readiness
							  	log(">> onNegotiationNeeded for " + callId);
							  	// Ready to join the call: say hello to each other
					  			if (isOwner) {
					  				sendHello().then(function() {
						  				log(">>> Sent Hello by " + (isOwner ? "owner" : "participant") + " to " + callId);
						  			});
							  		// Owner will send the offer when negotiation will be resolved (received Hello from others)
					  				negotiation.then(function() {
					  					log(">>> createOffer for " + callId);
									    pc.createOffer().then(function(desc) { // sdpConstraints
									    	log("<<< createOffer for " + callId);
									    	pc.setLocalDescription(desc).then(function() {
									    		log(">>>> setLocalDescription for " + callId);
									    		sendOffer(pc.localDescription).then(function() {
									    			log("<<<< setLocalDescription for " + callId);
									    			// TODO moved to after-answer code
										    		/* connection.resolve().then(function() {
											      	// Owner ready to exchange ICE candidates
															log("<<<<< Started exchange network information with peers of " + callId);
														});*/
									    		});
									      }).catch(function(err) {
									      	log("ERROR settings local offer for " + callId, err);
									      	handleError("Error of preparing connection", err);
										    });
									    }).catch(function(err) {
									    	log("ERROR creating offer for " + callId, err);
									    	handleError("Error of starting connection", err);
									    });
					  				});
							  	}
							  };			  	
							  // once remote stream arrives, show it in the remote video element
							  // TODO it's modern way of WebRTC stream addition, but it doesn't work in Chrome
							  /*pc.ontrack = function(event) {
							  	log(">>> onTrack for " + callId + " > " + new Date().toLocaleString());
							  	$remoteVideo.get(0).srcObject = event.streams[0];
							  };*/
								pc.onaddstream = function (event) { 
									// Remote video added: switch local to a mini and show the remote as main
									log(">> onAddStream for " + callId);
									// Stop local
									localVideo.pause();
									$localVideo.removeClass("active");
									$localVideo.hide();
									
									// Show remote
									remoteVideo.srcObject = event.stream;
									$remoteVideo.addClass("active");
									$remoteVideo.show();
									
									// Show local in mini
									miniVideo.srcObject = localVideo.srcObject;
									localVideo.srcObject = null;
									$miniVideo.addClass("active");
									$miniVideo.show();
									
									//
									$videos.addClass("active");
								};
							  pc.onremovestream = function(event) {
							  	// TODO check the event stream URL before removal?
							  	log(">> onRemoveStream for " + callId);
							  	// Stop remote
							  	remoteVideo.pause();
									$remoteVideo.removeClass("active");
									$remoteVideo.hide();
									remoteVideo.srcObject = null;
									
									// Show local
									localVideo.srcObject = miniVideo.srcObject;
									/*localVideo.onloadedmetadata = function(event1) {
										localVideo.play();
									};*/
									$localVideo.addClass("active");
									
									// Hide mini
									miniVideo.srcObject = null;
									$miniVideo.removeClass("active");
									$miniVideo.hide();
									
									//
									$videos.removeClass("active");
							  };
								
								// Subscribe to the call updates
								var listener = videoCalls.onCallUpdate(callId, function(message) {
									// TODO handle the remote side data
									if (message.provider == webrtc.getType()) {
										if (message.sender != currentUserId) {
											log(">>> Received call update for " + callId + ": " + JSON.stringify(message));
											if (message.candidate) {
												// ICE candidate of remote party (can happen several times)
												log(">>> Received candidate for " + callId);
												connection.then(function() {
													if (Object.getOwnPropertyNames(message.candidate).length > 0 || isEdge) {
														log(">>>> Apply candidate for " + callId);
														var candidate = new RTCIceCandidate(message.candidate);
														pc.addIceCandidate(candidate).then(function() {
														  log("<<<< Apllied candidate for " + callId);
														}).catch(function(err) {
															log("ERROR adding candidate for " + callId + ": " + err, err);
															handleError("Error establishing call", err);
														});														
													} else {
														log("<<<< Skipped candidate for " + callId);
													}
												});
											} else if (message.offer) {
												log(">>> Received offer for " + callId);
												// Offer of a caller on callee side
												if (isOwner) {
													log("<<< Unexpected offer received on owner side of " + callId);
												} else {
													try {
														var offer = JSON.parse(message.offer);
														if (isEdge) {
															offer = new RTCSessionDescription(offer);
														}
														negotiation.then(function(localStream) {
															log(">>>> setRemoteDescription for " + callId);
															pc.setRemoteDescription(offer).then(function() {
																log(">>>>> Apllied offer for " + callId);
													      // if we received an offer, we need to answer
													      if (pc.remoteDescription.type == "offer") {
													      	// Add local stream for participant after media negotiation (as in samples) 
													      	log(">>>>> addStream for " + callId);
													      	pc.addStream(localStream); // XXX It's deprecated way but Chrome works using it
													      	// Will it be better to do this in onnegotiationneeded event?
													      	log(">>>>> createAnswer for " + callId);
													      	pc.createAnswer().then(function(desc) { // sdpConstraints
													      		log("<<<<< createAnswer >>>>> setLocalDescription for " + callId);
													      		pc.setLocalDescription(desc).then(function() {
													      			log("<<<<<< setLocalDescription for " + callId);
													      			sendAnswer(pc.localDescription).then(function() {
													      				connection.resolve().then(function() {
													      					// Participant ready to exchange ICE candidates
																					log("<<<<<< Started exchange network information with peers of " + callId);
																				});
													      			});
													      		}).catch(function(err) {
													      			log("ERROR setting local answer for " + callId + ": " + err, err);
														      		handleError("Error accepting call", err);
													      		});
													      	}).catch(function(err) {
													      		log("ERROR answering offer for " + callId + ": " + err, err);
													      		handleError("Error answering call", err);
													      	});
													      } else {
													      	log("<<<<< remoteDescription type IS NOT 'offer' BUT " + pc.remoteDescription.type);
													      }
													    }).catch(function(err) {
													    	log("ERROR setting remote offer for " + callId + ": " + err, err);
													    	handleError("Error applying call", err);
													    });
														});
													} catch(e) {
														log("Error applying offer: " + message.offer, e);
													}
												}
											} else if (message.answer) {
												if (isOwner) {
													// Answer of a callee to the caller: it's final stage of the parties discovery
													log(">>> Received answer for " + callId);
													try {
														var answer = JSON.parse(message.answer);
														if (isEdge) {
															answer = new RTCSessionDescription(answer);
														}
														negotiation.then(function() {
															log(">>>> setRemoteDescription for " + callId);
															pc.setRemoteDescription(answer).then(function() {
													      log("<<<< Apllied answer for " + callId);
													      // TODO anything else here?
													      // TODO resolve connection (network) exchange only from here
													      connection.resolve().then(function() {
													      	// Owner ready to exchange ICE candidates
																	log("<<<<< Started exchange network information with peers of " + callId);
																});
													    }).catch(function(err) {
													    	log("ERROR setting remote answer for " + callId + ": " + err, err);
													    	handleError("Error answering call", err);
													    });
														});
													} catch(e) {
														log("Error applying answer: " + message.answer, e);
													}
												} else {
													// FYI this could be OK to receive for group call
													log("<<< Unexpected answer received on participant side of " + callId);
												}
											} else if (message.hello) {
												// To start the call send "hello" - first message in the flow for each client
												log(">>> Received Hello for " + callId + ": " + JSON.stringify(message.hello));
												if (message.hello == currentUserId) {
													// We assume it's a hello to the call owner: start sending offer and candidates
													// This will works once (for group calls, need re-initialize the process)
													negotiation.resolve().then(function() {
														log("<<< Started exchange media information of " + callId);
													});
												} else {
													log("<<< Hello was not to me (" + currentUserId + ")");
												}
											} else if (message.bye && false) {
												// TODO not used
												// Remote part leaved the call: stop listen the call
												log(">>> Received Bye for " + callId + ": " + JSON.stringify(message.bye));
												if (message.bye == currentUserId || message.bye == "__all__") {
													// We assume it's a Bye from the call owner or other party to us: ends the call locally and close the window
													stopCall(true);
													listener.off();											
												} else {
													log("<<< Bye was not to me (" + currentUserId + ")");
												}
											} else {
												log("<<< Received unexpected message for " + callId);
											}
										} else {
											//log("<<< skip own update");
										}
									}
								}, function(err) {
									log("ERROR subscribe to " + callId + ": " + err, err);
									process.reject("Error setting up connection (subscribe call updates): " + err);
									handleError("Connection error", videoCalls.errorText(err));
								});
								
								// Show current user camera in the video,
								var inputsReady = $.Deferred();
								try {
									navigator.mediaDevices.enumerateDevices().then(function(devices) {
										// device it's MediaDeviceInfo
										var cams = devices.filter(function(device) { 
											return device.kind == "videoinput";
										});
										var mics = devices.filter(function(device) { 
											return device.kind == "audioinput";
										});
								    
										var constraints = {
										};
								    if (mics.length > 0) {
								    	constraints.audio = true;
								    	if (cams.length > 0) {
								    		// TODO use optimal camera res and video quality
								    		// TODO 720p (1280x720) is an optimal for all cases
								    		// TODO then 960x720, 640x480 and 320x240, 160x120
								    		var vw, vh, vwmin, vhmin; 
								    		var isPortrait = screen.width < screen.height; 
								    		/*if (screen.width >= 1280) {
								    			vw = 1280;
								    			vh = 720;
								    		} else */if (screen.width >= 640) {
								    			vw = 640;
								    			vh = 480;
								    		} else {
								    			vw = 320;
								    			vh = 240;
								    		}
								    		var videoSettings = {
											  	width: { min: isPortrait ? vh : vw, ideal: isPortrait ? 720 : 1280 }
											  	//height: { min: 480, ideal: vh } // 360? it's small mobile like Galaxy S7
											  };
								    		constraints.video = true;
									    	//constraints.video = videoSettings;
								    		if (typeof constraints.video == "Object") {
								    			try {
														var supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
														if (supportedConstraints.hasOwnProperty("facingMode")) {
															constraints.video.facingMode = "user"; // or { exact: "user" }
														}
													} catch(e) {
														log("WARN MediaDevices.getSupportedConstraints() failed to execute:", e);
													}							    			
								    		}
									    } else {
									    	constraints.video = false;
									    }
								    	inputsReady.resolve(constraints, "Found audio" + (constraints.video ? " and video" : ""));
								    } else {
								    	inputsReady.reject("No audio input found." + (cams.length > 0 ? " But video found." : ""));
								    }
									});
								} catch(e) {
									log("WARN MediaDevices.enumerateDevices() failed to execute:", e);
									inputsReady.resolve({
										audio : true,
										video : true
									}, "Unable read devices, go with default audio and video.");
								}
								inputsReady.done(function(constraints, comment) {
									log("Media constraints: " + JSON.stringify(constraints) + " " + comment);
									// When using shim adapter.js don't need do the selection like below
									// var userMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
									navigator.mediaDevices.getUserMedia(constraints).then(function(localStream) {
										// successCallback
										// show local camera output
										localVideo.srcObject = localStream;
										/*localVideo.onloadedmetadata = function(event) {
											localVideo.play();
										};*/
										$localVideo.addClass("active");
										
										var $muteAudio = $controls.find("#mute-audio");
										$muteAudio.click(function() {
											var audioTracks = localStream.getAudioTracks();
											if (audioTracks.length > 0) {
												for (var i = 0; i < audioTracks.length; ++i) {
													audioTracks[i].enabled = !audioTracks[i].enabled;
											  }
												$muteAudio.toggleClass("on");
												log("Audio " + (audioTracks[0].enabled ? "un" : "") + "muted for " + callId);
											}
										});
										var $muteVideo = $controls.find("#mute-video");
										$muteVideo.click(function() {
											var videoTracks = localStream.getVideoTracks();
											if (videoTracks.length > 0) {
												for (var i = 0; i < videoTracks.length; ++i) {
													videoTracks[i].enabled = !videoTracks[i].enabled;
											  }
												$muteVideo.toggleClass("on");
												log("Video " + (videoTracks[0].enabled ? "un" : "") + "muted for " + callId);									
											}
										});

									  log("Starting call " + callId + " > " + new Date().toLocaleString());
									  // add local stream for owner right now
									  if (isOwner) {
										  pc.addStream(localStream); 
										  // XXX It's deprecated way but Chrome works using it
										  //localStream.getTracks().forEach(function(track) {
										  //  pc.addTrack(track, localStream);
										  //});
									  } else {
									  	// Participant sends Hello to the other end to initiate a negotiation there
									  	sendHello().then(function() {
							  				log(">>>> Sent Hello by participant to " + callId);
							  				// Participant on the other end is ready for negotiation and waits for an offer message
									  		negotiation.resolve(localStream).then(function() {
													log("<<<< Started exchange media information of " + callId);
												});
							  			});
									  }
									  connection.then(function() {
									  	webrtc.joinedCall(callId).done(function() {
									  		log("<<< Joined the call " + callId);
									  	});
									  });
									}).catch(function(err) {
										// errorCallback
										log(">> User media error: " + err + ", " + JSON.stringify(err), err);  
										// process.reject("User media error: " + err);
										handleError("Media error", err);
									});
								}).fail(function(err) {
									log("Media devices error: " + err, err);
									handleError("Media required", err);
								});
								// Resolve this in any case of above media devices discovery result
								process.resolve("started");
							} catch(e) {
								log("ERROR creating RTC peer connection for " + callId, e);
								process.reject("Connection error: " + (e.message ? e.message : e));
								handleError("Connection failed", e);
							}
						}
					} else {
						process.reject("WebRTC not supported in this browser: " + navigator.userAgent);
						showError("Not supported platform", "Your browser does not support WebRTC calls.");
					}
				} else {
					process.reject("WebRTC provider not found");
				}
			});
			return process.promise();
		};
		
		log("< Loaded at " + location.origin + location.pathname);
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for webrtc-call.js");
}
