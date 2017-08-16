<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>

<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>WebRTC Call</title>
	<link href="/webrtc/skin/webrtc-call.css" rel="stylesheet" type="text/css"/>
    <script type="text/javascript" src="/videocalls/js/jquery-3.2.1.js"></script>
    <script type="text/javascript" src="/videocalls/js/jquery-ui.min.js"></script>
    <script type="text/javascript" src="/videocalls/js/jquery.pnotify.min.js"></script>
    <script type="text/javascript" src="/videocalls/js/videocalls.js"></script>
    <script type="text/javascript" src="/webrtc/js/videocalls-webrtc.js"></script>
    <script type="text/javascript">
	   	if (eXo.videoCalls) {
			(function(videoCalls) {
			  "use strict";
			  videoCalls.init(${userInfo}, ${contextInfo});
			  videoCalls.webrtc.configure(${settings});
			  videoCalls.addProvider(videoCalls.webrtc);
			})(eXo.videoCalls);
	   	} else {
	   		console.log("eXo.videoCalls not defined for WebRTC Call page");
	   	}
	</script>
</head>
<body>
	<div id="webrtc-call-starting">
		<div class="waitThrobber"></div>
	</div>
	<script type="text/javascript" src="/webrtc/js/webrtc-call.js"></script>	
</body>
</html>