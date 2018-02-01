/**
 * 
 */
package org.exoplatform.webconferencing.skype.server;

import static org.exoplatform.webconferencing.Utils.asJSON;
import static org.exoplatform.webconferencing.Utils.buildUrl;
import static org.exoplatform.webconferencing.Utils.getCurrentContext;

import java.io.IOException;
import java.io.UnsupportedEncodingException;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.exoplatform.container.ExoContainer;
import org.exoplatform.container.web.AbstractHttpServlet;
import org.exoplatform.webconferencing.ContextInfo;
import org.exoplatform.webconferencing.UserInfo;
import org.exoplatform.webconferencing.WebConferencingService;
import org.exoplatform.webconferencing.skype.SkypeBusinessProvider;
import org.exoplatform.webconferencing.skype.SkypeProvider.SkypeSettings;
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
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {

    Object redirectUri = req.getAttribute(SkypeCallFilter.SKYPE_CALL_REDIRECT);
    if (redirectUri != null) {
      // Home page registered per app in Active Directory - redirect it to the portal default page
      String ruri = (String) redirectUri;
      if (ruri.length() > 0) {
        resp.sendRedirect(ruri);
      }
    } else {
      resp.setContentType("text/html; charset=UTF-8");

      String remoteUser = req.getRemoteUser();

      ExoContainer container = getContainer();
      WebConferencingService webConferencing = container.getComponentInstanceOfType(WebConferencingService.class);
      if (webConferencing != null) {
        SkypeBusinessProvider provider;
        try {
          provider = (SkypeBusinessProvider) webConferencing.getProvider(SkypeBusinessProvider.SFB_TYPE);
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
              UserInfo exoUser = webConferencing.getUserInfo(remoteUser);
              if (exoUser != null) {
                req.setAttribute("userInfo", asJSON(exoUser));

                String spaceId = req.getParameter("space");
                if (spaceId == null) {
                  spaceId = EMPTY_STRING;
                }
                String roomTitle = req.getParameter("room");
                if (roomTitle == null) {
                  roomTitle = EMPTY_STRING;
                }
                ContextInfo context = getCurrentContext(remoteUser, req.getLocale());
                req.setAttribute("contextInfo", asJSON(context));
                SkypeSettings settings = provider.settings()
                                                 .redirectURI(buildUrl(req.getScheme(),
                                                                       req.getServerName(),
                                                                       req.getServerPort(),
                                                                       "/portal/skype/call"))
                                                 .build();
                req.setAttribute("settings", asJSON(settings));

                // XXX nasty-nasty-nasty include of CometD script
                req.getRequestDispatcher("/WEB-INF/pages/call_part1.jsp").include(req, resp);
                ServletContext cometdContext = req.getSession().getServletContext().getContext("/cometd");
                cometdContext.getRequestDispatcher("/javascript/eXo/commons/commons-cometd3.js").include(req, resp);
                req.getRequestDispatcher("/WEB-INF/pages/call_part2.jsp").include(req, resp);

                // NOT USED: single JSP page
                // httpReq.getRequestDispatcher(CALL_PAGE).include(httpReq, httpRes);
              } else {
                LOG.warn("Skype Call servlet cannot be initialized: user info cannot be obtained for " + remoteUser);
              }
            } catch (Exception e) {
              LOG.error("Error processing Skype call page", e);
              resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
              req.getRequestDispatcher(SERVER_ERROR_PAGE).include(req, resp);
            }
          } else {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            req.getRequestDispatcher(UNAUTHORIZED_PAGE).include(req, resp);
          }
        } else {
          LOG.error("Skype provider not found for call page and user " + remoteUser);
          resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
          req.getRequestDispatcher(SERVER_ERROR_PAGE).include(req, resp);
        }
      } else {
        LOG.error("Web Conferencing service not found for call page and user " + remoteUser);
        resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        req.getRequestDispatcher(SERVER_ERROR_PAGE).include(req, resp);
      }
    }
  }

  /**
   * {@inheritDoc}
   */
  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
    doGet(req, resp);
  }

}
