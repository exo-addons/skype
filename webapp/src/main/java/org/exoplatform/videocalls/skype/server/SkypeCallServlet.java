/**
 * 
 */
package org.exoplatform.videocalls.skype.server;

import static org.exoplatform.videocalls.VideoCallsUtils.asJSON;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URI;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.exoplatform.container.ExoContainer;
import org.exoplatform.container.web.AbstractHttpServlet;
import org.exoplatform.videocalls.ContextInfo;
import org.exoplatform.videocalls.UserInfo;
import org.exoplatform.videocalls.VideoCallsService;
import org.exoplatform.videocalls.cometd.CometdVideoCallsService;
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

  /** The Constant EMPTY_STRING. */
  private final static String   EMPTY_STRING      = "".intern();

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

    Object redirectUri = httpReq.getAttribute(SkypeCallFilter.SKYPE_CALL_REDIRECT);
    if (redirectUri != null) {
      // Home page registered per app in Active Directory - redirect it to the portal default page
      String ruri = (String) redirectUri;
      if (ruri.length() > 0) {
        httpRes.sendRedirect(ruri);
      }
    } else {
      httpRes.setContentType("text/html; charset=UTF-8");

      String remoteUser = httpReq.getRemoteUser();

      ExoContainer container = getContainer();
      VideoCallsService videoCalls = container.getComponentInstanceOfType(VideoCallsService.class);
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
              UserInfo exoUser = videoCalls.getUserInfo(remoteUser);
              if (exoUser != null) {
                httpReq.setAttribute("userInfo", asJSON(exoUser));

                // init page scope with settings for videoCalls and Skype provider
                String title = httpReq.getParameter("title");
                httpReq.setAttribute("callTitle", title != null ? title : EMPTY_STRING);

                String spaceId = httpReq.getParameter("space");
                if (spaceId == null) {
                  spaceId = EMPTY_STRING;
                }
                String roomTitle = httpReq.getParameter("room");
                if (roomTitle == null) {
                  roomTitle = EMPTY_STRING;
                }
                ContextInfo context;
                CometdVideoCallsService cometd =
                                               container.getComponentInstanceOfType(CometdVideoCallsService.class);
                if (cometd != null) {
                  context = new ContextInfo(container.getContext().getName(),
                                            spaceId,
                                            roomTitle,
                                            cometd.getCometdServerPath(),
                                            cometd.getUserToken(remoteUser));
                } else {
                  context = new ContextInfo(container.getContext().getName(), spaceId, roomTitle);
                }
                httpReq.setAttribute("contextInfo", asJSON(context));

                URI redirectURI = new URI(httpReq.getScheme(),
                                          null,
                                          httpReq.getServerName(),
                                          httpReq.getServerPort(),
                                          "/portal/skype/call",
                                          null,
                                          null);
                SkypeSettings settings = provider.getSettings().redirectURI(redirectURI.toString()).build();
                httpReq.setAttribute("settings", asJSON(settings));

                // XXX nasty-nasty-nasty include of CometD script
                httpReq.getRequestDispatcher("/WEB-INF/pages/call_part1.jsp").include(httpReq, httpRes);
                ServletContext cometdContext = httpReq.getSession().getServletContext().getContext("/cometd");
                cometdContext.getRequestDispatcher("/javascript/eXo/commons/commons-cometd3.js")
                             .include(httpReq, httpRes);
                httpReq.getRequestDispatcher("/WEB-INF/pages/call_part2.jsp").include(httpReq, httpRes);

                // NOT USED: single JSP page
                // httpReq.getRequestDispatcher(CALL_PAGE).include(httpReq, httpRes);
              } else {
                LOG.warn("Skype Call servlet cannot be initialized: user info cannot be obtained for "
                    + remoteUser);
              }
            } catch (Exception e) {
              LOG.error("Error processing Skype call page", e);
              httpRes.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
              httpReq.getRequestDispatcher(SERVER_ERROR_PAGE).include(httpReq, httpRes);
            }
          } else {
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
