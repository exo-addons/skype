/**
 * 
 */
package org.exoplatform.videocalls.skype.server;

import static org.exoplatform.videocalls.VideoCallsUtils.asJSON;
import static org.exoplatform.videocalls.VideoCallsUtils.getCurrentContext;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URI;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.exoplatform.container.ExoContainer;
import org.exoplatform.container.web.AbstractHttpServlet;
import org.exoplatform.videocalls.ContextInfo;
import org.exoplatform.videocalls.UserInfo;
import org.exoplatform.videocalls.VideoCallsService;
import org.exoplatform.videocalls.skype.SkypeBusinessProvider;
import org.exoplatform.videocalls.skype.SkypeSettings;
import org.gatein.common.logging.Logger;
import org.gatein.common.logging.LoggerFactory;

/**
 * The Class SkypeCallServlet.
 */
public class SkypeCallServlet extends AbstractHttpServlet {

  /** The Constant serialVersionUID. */
  private static final long     serialVersionUID  = -6075521943684342591L;

  /** The Constant LOG. */
  protected static final Logger LOG               = LoggerFactory.getLogger(SkypeCallServlet.class);

  /** The Constant CALL_PAGE. */
  private final static String   CALL_PAGE         = "/WEB-INF/pages/call.jsp";

  /** The Constant UNAUTHORIZED_PAGE. */
  private final static String   UNAUTHORIZED_PAGE = "/WEB-INF/pages/unauthorized.html";

  /** The Constant SERVER_ERROR_PAGE. */
  private final static String   SERVER_ERROR_PAGE = "/WEB-INF/pages/servererror.html";

  /**
   * Instantiates a new skype call servlet.
   */
  public SkypeCallServlet() {
    //
  }

  /**
   * {@inheritDoc}
   */
  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException,
                                                                         IOException {

    HttpServletRequest httpReq = (HttpServletRequest) req;
    HttpServletResponse httpRes = (HttpServletResponse) resp;
    httpRes.setContentType("text/html; charset=UTF-8");

    String remoteUser = httpReq.getRemoteUser();

    ExoContainer container = getContainer();
    VideoCallsService videoCalls =
                                 (VideoCallsService) container.getComponentInstanceOfType(VideoCallsService.class);
    if (videoCalls != null) {
      SkypeBusinessProvider provider;
      try {
        provider = (SkypeBusinessProvider) videoCalls.getProvider(SkypeBusinessProvider.SFB_TYPE);
      } catch (ClassCastException e) {
        LOG.error("Provider " + SkypeBusinessProvider.SFB_TYPE + " isn't an instance of "
            + SkypeBusinessProvider.class.getName(), e);
        provider = null;
      }

      if (provider != null) {
        try {
          // We set the character encoding now to UTF-8 before obtaining parameters
          req.setCharacterEncoding("UTF-8");
        } catch (UnsupportedEncodingException e) {
          LOG.error("Encoding not supported", e);
        }

        if (remoteUser != null) {
          try {
            // init page scope with settings for videoCalls and Skype provider

            ContextInfo context = getCurrentContext();
            httpReq.setAttribute("spaceInfo", asJSON(context));

            UserInfo exoUser = videoCalls.getUserInfo(remoteUser);
            httpReq.setAttribute("userInfo", asJSON(exoUser));

            URI redirectURI =
                            new URI(httpReq.getScheme(),
                                    null,
                                    httpReq.getServerName(),
                                    httpReq.getServerPort(),
                                    null,
                                    null,
                                    null);
            SkypeSettings settings = provider.getSettings().redirectURIBase(redirectURI.toString()).build();
            httpReq.setAttribute("settings", asJSON(settings));

            // XXX//
            // ServletContainer container = ServletContainerFactory.getServletContainer();
            // container.include(httpReq.getServletContext(), httpReq, httpRes, new RequestDispatchCallback()
            // {
            // @Override
            // public Object doCallback(ServletContext dispatchedServletContext,
            // HttpServletRequest dispatchedRequest,
            // HttpServletResponse dispatchedResponse,
            // Object handback) throws ServletException, IOException {
            // // XXX do nothing for our purpose
            // // callable.call(dispatchedServletContext, dispatchedRequest, dispatchedResponse);
            //
            // // We don't use return value anymore
            // return null;
            // }
            // }, null);
            ////

            // forward to JSP page
            httpReq.getRequestDispatcher(CALL_PAGE).include(httpReq, httpRes);
          } catch (Exception e) {
            LOG.error("Error processing Skype call page", e);
            httpRes.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            httpReq.getRequestDispatcher(SERVER_ERROR_PAGE).include(httpReq, httpRes);
          }
        } else {
          // TODO user not authenticated into eXo Platform
          // Redirect to login page?
          // Return 401 Unauthorized?
          // httpRes.sendError(HttpURLConnection.HTTP_UNAUTHORIZED, "");
          httpRes.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
          httpReq.getRequestDispatcher(UNAUTHORIZED_PAGE).include(httpReq, httpRes);
        }
      } else {
        LOG.error("Skype provider not found for call page and user " + remoteUser);
        httpRes.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        httpReq.getRequestDispatcher(SERVER_ERROR_PAGE).include(httpReq, httpRes);
      }
    } else {
      LOG.error("Video Calls service not found for call page and user " + remoteUser);
      httpRes.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
      httpReq.getRequestDispatcher(SERVER_ERROR_PAGE).include(httpReq, httpRes);
    }
  }

  /**
   * {@inheritDoc}
   */
  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException,
                                                                          IOException {
    doGet(req, resp);
  }

}
