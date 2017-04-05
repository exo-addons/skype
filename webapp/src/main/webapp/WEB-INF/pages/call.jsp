<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c"%>

<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Skype Call</title>
	<link href="/skype/skin/skype.css" rel="stylesheet" type="text/css"/>
    <script type="text/javascript" src="/skype/js/jquery-3.2.1.js"></script>
    <script type="text/javascript" src="https://swx.cdn.skype.com/shared/v/1.2.15/SkypeBootstrap.min.js"></script>
    <script type="text/javascript" src="/videocalls/js/videocalls.js"></script>
    <script type="text/javascript" src="/skype/js/videocalls-skype.js"></script>
    <script type="text/javascript">
    	if (eXo.videoCalls) {
			(function(videoCalls) {
			  "use strict";
			  videoCalls.init(${userInfo}, ${spaceInfo});
			  videoCalls.skype.configure(${settings}); 
			  videoCalls.addProvider(videoCalls.skype);
			  //delete videoCalls.skype; // release 
			})(eXo.videoCalls);
    	} else {
    		console.log("eXo.videoCalls not defined for Skype Call page");
    	}
	</script>
	<script type="text/javascript" src="/skype/js/skype-call.js"></script>
</head>
<body>
	
</body>
</html>