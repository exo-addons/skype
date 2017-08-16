
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
package org.exoplatform.videocalls.webrtc.server;

import java.io.IOException;

import javax.servlet.FilterChain;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.exoplatform.container.web.AbstractFilter;
import org.exoplatform.web.filter.Filter;
import org.gatein.common.logging.Logger;
import org.gatein.common.logging.LoggerFactory;

/**
 * Filter forwards requests to Skype call URLs to related servlets.<br>
 * 
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: WebrtcCallFilter.java 00000 Aug 14, 2017 pnedonosko $
 * 
 */
public class WebrtcCallFilter extends AbstractFilter implements Filter {

  /** The Constant LOG. */
  protected static final Logger LOG                 = LoggerFactory.getLogger(WebrtcCallFilter.class);

  /** The Constant WEBRTC_CALL_REDIRECT. */
  public static final String    WEBRTC_CALL_REDIRECT = "webrtccall_redirect";

  /** The Constant WEBRTC_SERVLET_CTX. */
  public static final String    WEBRTC_SERVLET_CTX   = "/webrtc";

  /** The Constant CALL_SERVLET. */
  public static final String    CALL_SERVLET        = "/webrtccallservlet".intern();

  /**
   * {@inheritDoc}
   */
  @Override
  public void doFilter(ServletRequest request,
                       ServletResponse response,
                       FilterChain chain) throws IOException, ServletException {
    HttpServletRequest httpReq = (HttpServletRequest) request;
    HttpServletResponse httpRes = (HttpServletResponse) response;

    if (httpReq.getRemoteUser() != null) {
      String uri = httpReq.getRequestURI();
      if (uri.endsWith("/webrtc/call/home")) {
        // If user needs a Home page redirect him to the portal default page
        httpReq.setAttribute(WEBRTC_CALL_REDIRECT, "/portal");
      } else {
        ServletContext context = httpReq.getSession().getServletContext().getContext(WEBRTC_SERVLET_CTX);
        context.getRequestDispatcher(CALL_SERVLET).forward(httpReq, httpRes);
      }
    } else {
      // TODO user not authenticated into eXo Platform
      // Redirect to login page?
      // Return 401 Unauthorized?
      chain.doFilter(request, response);
    }
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public void destroy() {
    // nothing
  }
}
