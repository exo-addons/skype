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
    <script type="text/javascript" src="/cometd/org/cometd.js"></script>
    <script type="text/javascript" src="/cometd/jquery/jquery.cometd.js"></script>
    <script>
	    //var cometd3Path="/cometd/javascript/eXo/commons/commons-cometd3.js";
    	var cCometD =