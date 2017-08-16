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
package org.exoplatform.videocalls.webrtc.profile.webui;

import java.io.IOException;

import org.exoplatform.container.configuration.ConfigurationException;
import org.exoplatform.social.core.profile.settings.IMType;
import org.exoplatform.social.core.profile.settings.UserProfileSettingsService;
import org.exoplatform.social.webui.profile.settings.UIIMControlRenderer;
import org.exoplatform.videocalls.webrtc.WebrtcProvider;
import org.exoplatform.webui.application.WebuiRequestContext;

/**
 * WebRTC IM control renderer for user profile form.
 * 
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeBusinessIMRenderer.java 00000 May 4, 2017 pnedonosko $
 */
public class WebRTCIMRenderer extends UIIMControlRenderer {

  /**
   * Instantiates a new WebRTC business IM renderer.
   *
   * @param imtype the imtype
   */
  WebRTCIMRenderer(IMType imtype) {
    super(imtype);
  }

  /**
   * Instantiates a new WebRTC business IM renderer.
   *
   * @param settingsService the settings service
   * @throws ConfigurationException the configuration exception
   */
  public WebRTCIMRenderer(UserProfileSettingsService settingsService) throws ConfigurationException {
    super(findIMType(WebrtcProvider.WEBRTC_TYPE, settingsService));
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public void render(String imValue, WebuiRequestContext context) throws IOException, Exception {
    // add Javascript/markup here
    StringBuffer elem = new StringBuffer();
    elem.append("<a class='actionIcon webrtcControl' data-placement='bottom' rel='tooltip' title='' data-original-title='Settings' href='javascript:void(0)'>")
        .append("<i class='uiIconSettings uiIconLightGray'></i></a>");
    context.getWriter().append(elem.toString());
    context.getJavascriptManager().require("SHARED/videoCalls_webrtc", "webrtcProvider");
  }

}
