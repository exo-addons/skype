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
package org.exoplatform.videocalls.portlet;

import static org.exoplatform.videocalls.VideoCallsUtils.asJSON;
import static org.exoplatform.videocalls.VideoCallsUtils.getCurrentContext;

import java.io.IOException;

import javax.portlet.GenericPortlet;
import javax.portlet.PortletException;
import javax.portlet.RenderRequest;
import javax.portlet.RenderResponse;

import org.exoplatform.container.ExoContainer;
import org.exoplatform.container.ExoContainerContext;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.videocalls.ContextInfo;
import org.exoplatform.videocalls.UserInfo;
import org.exoplatform.videocalls.VideoCallsService;
import org.exoplatform.web.application.JavascriptManager;
import org.exoplatform.webui.application.WebuiRequestContext;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: VideoCallsPortlet.java 00000 Mar 29, 2017 pnedonosko $
 */
public class VideoCallsPortlet extends GenericPortlet {

  /** The Constant LOG. */
  private static final Log  LOG = ExoLogger.getLogger(VideoCallsPortlet.class);

  /** The videocalls. */
  private VideoCallsService videocalls;

  /**
   * {@inheritDoc}
   */
  @Override
  public void init() throws PortletException {
    super.init();

    ExoContainer container = ExoContainerContext.getCurrentContainer();
    this.videocalls = container.getComponentInstanceOfType(VideoCallsService.class);
  }

  /**
   * {@inheritDoc}
   */
  @Override
  protected void doView(final RenderRequest request, final RenderResponse response) throws PortletException,
                                                                                    IOException {
    final String remoteUser = request.getRemoteUser();

    try {
      // So far we don't need any server-side markup for this portlet.
      // PortletRequestDispatcher prd =
      // getPortletContext().getRequestDispatcher("/WEB-INF/pages/videocalls.jsp");
      // prd.include(request, response);
      // TODO Get bundle messages for status/error texts
      // Locale locale = userContext.getLocale();
      // ResourceBundle bundle = applicationContext.resolveBundle(locale);

      ContextInfo context = getCurrentContext();
      String contextJson = asJSON(context);

      UserInfo exoUser = videocalls.getUserInfo(remoteUser);
      if (exoUser != null) {
        String exoUserJson = asJSON(exoUser);

        JavascriptManager js =
                             ((WebuiRequestContext) WebuiRequestContext.getCurrentInstance()).getJavascriptManager();
        js.require("SHARED/videoCallsPortlet", "videoCallsPortlet")
          .addScripts("videoCallsPortlet.start(" + exoUserJson + "," + contextJson + ");");
      } else {
        LOG.warn("Video Calls portlet cannot be initialized: user info cannot be obtained for " + remoteUser);
      }
    } catch (Exception e) {
      LOG.error("Error processing Video Calls portlet for user " + remoteUser, e);
    }
  }

}
