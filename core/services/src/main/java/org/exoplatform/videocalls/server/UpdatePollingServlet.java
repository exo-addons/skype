/*
 * Copyright (C) 2003-2017 eXo Platform SAS.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 */
package org.exoplatform.videocalls.server;

import java.io.IOException;
import java.nio.charset.Charset;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.servlet.AsyncContext;
import javax.servlet.AsyncEvent;
import javax.servlet.AsyncListener;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.exoplatform.container.web.AbstractHttpServlet;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.videocalls.IncomingCallListener;
import org.exoplatform.videocalls.VideoCallsService;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: UpdatePollingServlet.java 00000 Jul 18, 2017 pnedonosko $
 */
// @WebServlet(urlPatterns = {"/updateServlet"}, asyncSupported=true)
public class UpdatePollingServlet extends AbstractHttpServlet {

  /** The Constant LOG. */
  protected static final Log LOG              = ExoLogger.getLogger(UpdatePollingServlet.class);

  /** The Constant DEFAULT_TIMEOUT. */
  public static final int    DEFAULT_TIMEOUT  = 180000;                                          // 5min:
                                                                                                // 300000

  /** The Constant serialVersionUID. */
  private static final long  serialVersionUID = -44481362110127541L;

  /**
   * {@inheritDoc}
   */
  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException,
                                                                         IOException {
    String pathInfo = req.getPathInfo();
    String remoteUser = req.getRemoteUser();
    if (remoteUser != null) {
      if (pathInfo != null && pathInfo.length() > 1) {
        // TODO extract from the request (on path /videocalls/updates/{userId}
        pathInfo = pathInfo.substring(1); // omit first slash
        int userEndIndex = pathInfo.indexOf('/');
        String userId = userEndIndex > 0 ? pathInfo.substring(0, userEndIndex) : pathInfo;
        if (userId.equals(remoteUser)) {
          final AtomicBoolean polling = new AtomicBoolean(true);
          final AsyncContext acontext = req.startAsync(req, resp);
          acontext.setTimeout(DEFAULT_TIMEOUT);
          acontext.addListener(new AsyncListener() {

            @Override
            public void onComplete(AsyncEvent event) throws IOException {
              polling.set(false); // TODO do we need it here? We already do in onCall() below
            }

            @Override
            public void onTimeout(AsyncEvent event) throws IOException {
              // It's normal
              if (polling.compareAndSet(true, false)) {
                //LOG.warn(">>> UpdatePollingServlet timeout for " + userId);
                HttpServletResponse resp = (HttpServletResponse) event.getSuppliedResponse();
                if (!resp.isCommitted()) {
                  sendRetry(resp);
                  acontext.complete();
                } else {
                  LOG.warn("<<< UpdatePollingServlet already committed for " + userId);
                }
              }
            }

            @Override
            public void onError(AsyncEvent event) throws IOException {
              polling.set(false);
              Throwable err = event.getThrowable();
              if (err != null) {
                LOG.error("Error in UpdatePollingServlet for " + userId, err);
              } else {
                LOG.error("Error in UpdatePollingServlet for " + userId);
              }
            }

            @Override
            public void onStartAsync(AsyncEvent event) throws IOException {
              // TODO ?
            }
          });

          // ServletContext appScope = req.getServletContext();

          //
          VideoCallsService videoCalls = getContainer().getComponentInstanceOfType(VideoCallsService.class);
          videoCalls.addUserListener(new IncomingCallListener(userId) {
            @Override
            public void onCall(String callId, String callState, String callerId, String callerType) {
              if (polling.compareAndSet(true, false)) {
                StringBuilder body = new StringBuilder();
                body.append('{');
                body.append("\"eventType\": \"call_state\",");
                body.append("\"callId\": \"");
                body.append(callId);
                body.append('\"');
                body.append(",\"callState\": \"");
                body.append(callState);
                body.append("\",\"caller\": {");
                body.append("\"id\": \"");
                body.append(callerId);
                body.append("\",\"type\": \"");
                body.append(callerType);
                body.append("\"}");
                body.append('}');
                String result = body.toString();

                HttpServletResponse response = (HttpServletResponse) acontext.getResponse();
                response.setContentType("text/json");
                response.setCharacterEncoding("UTF-8");
                byte[] entity = result.getBytes(Charset.forName("UTF-8"));
                response.setContentLength(entity.length);
                response.setStatus(HttpServletResponse.SC_OK);
                response.setHeader("Cache-Control", "no-cache");
                try {
                  response.getOutputStream().write(entity);
                } catch (IOException e) {
                  LOG.error("Error completing call update request", e);
                  try {
                    response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                  } catch (IOException e1) {
                    LOG.error("Error sending error to call update request", e1);
                  }
                } finally {
                  acontext.complete();
                }
              } else {
                LOG.warn(">>> Fired onCall(" + callId + ", " + callState
                    + ") for already completed UpdatePollingServlet");
              }
            }
          });
        } else {
          LOG.warn("Accessing other user updates forbidden for " + remoteUser + ", has requested updates of "
              + userId);
          sendError(resp, "Access forbidden", HttpServletResponse.SC_FORBIDDEN);
        }
      } else {
        LOG.warn("Wrong call update request path: " + pathInfo);
        sendError(resp, "Wrong request path", HttpServletResponse.SC_BAD_REQUEST);
      }
    } else {
      LOG.warn("Unauthorized request to call update: " + pathInfo);
      sendError(resp, "Unauthorized user", HttpServletResponse.SC_UNAUTHORIZED);
    }
  }

  /**
   * Send retry.
   *
   * @param resp the resp
   */
  private void sendRetry(HttpServletResponse resp) {
    resp.setContentType("text/json");
    resp.setCharacterEncoding("UTF-8");
    byte[] entity = ("{\"eventType\": \"retry\"}").getBytes(Charset.forName("UTF-8"));
    resp.setContentLength(entity.length);
    resp.setStatus(HttpServletResponse.SC_OK);
    resp.setHeader("Cache-Control", "no-cache");
    try {
      resp.getOutputStream().write(entity);
    } catch (IOException e) {
      LOG.error("Failed handling call update request retry", e);
      try {
        resp.sendError(500);
      } catch (IOException e1) {
        LOG.error("Error sending error for call update request retry", e1);
      }
    }
  }

  /**
   * Send error.
   *
   * @param resp the resp
   * @param message the message
   * @param status the status
   */
  private void sendError(HttpServletResponse resp, String message, int status) {
    resp.setContentType("text/json");
    resp.setCharacterEncoding("UTF-8");
    byte[] entity = ("{\"error\": \"" + message + "\"}").getBytes(Charset.forName("UTF-8"));
    resp.setContentLength(entity.length);
    resp.setStatus(status);
    resp.setHeader("Cache-Control", "no-cache");
    try {
      resp.getOutputStream().write(entity);
    } catch (IOException e) {
      LOG.error("Failed handling call update request error", e);
      try {
        resp.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
      } catch (IOException e1) {
        LOG.error("Error sending error for call update request failure", e1);
      }
    }
  }

  /*
   * @Override
   * protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException,
   * IOException {
   * List<AsyncContext> asyncContexts = new ArrayList<>(this.contexts);
   * this.contexts.clear();
   * String name = request.getParameter("name");
   * String message = request.getParameter("message");
   * String htmlMessage = "<p><b>" + name + "</b><br/>" + message + "</p>";
   * ServletContext sc = request.getServletContext();
   * if (sc.getAttribute("messages") == null) {
   * sc.setAttribute("messages", htmlMessage);
   * } else {
   * String currentMessages = (String) sc.getAttribute("messages");
   * sc.setAttribute("messages", htmlMessage + currentMessages);
   * }
   * for (AsyncContext asyncContext : asyncContexts) {
   * try (PrintWriter writer = asyncContext.getResponse().getWriter()) {
   * writer.println(htmlMessage);
   * writer.flush();
   * asyncContext.complete();
   * } catch (Exception ex) {
   * }
   * }
   * }
   */

}
