<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>

<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Skype for Business Call</title>
	<link href="/skype/skin/skype.css" rel="stylesheet" type="text/css"/>
    <script type="text/javascript" src="/skype/js/jquery-3.2.1.js"></script>
    <script type="text/javascript" src="/videocalls/js/jquery-ui.min.js"></script>
    <script type="text/javascript" src="/videocalls/js/jquery.pnotify.min.js"></script>
    <script type="text/javascript" src="https://swx.cdn.skype.com/shared/v/1.2.15/SkypeBootstrap.min.js"></script>
    <script type="text/javascript" src="/videocalls/js/videocalls.js"></script>
    <script type="text/javascript" src="/skype/js/videocalls-mssfb.js"></script>
    <script type="text/javascript">
    	if (eXo.videoCalls) {
			(function(videoCalls) {
			  "use strict";
			  videoCalls.init(${userInfo}, ${spaceInfo});
			  videoCalls.mssfb.configure(${settings}); 
			  videoCalls.addProvider(videoCalls.mssfb);
			})(eXo.videoCalls);
    	} else {
    		console.log("eXo.videoCalls not defined for Skype for Business Call page");
    	}
	</script>
	<script type="text/javascript" src="/skype/js/mssfb-call.js"></script>
</head>
<body>
	
</body>
</html>