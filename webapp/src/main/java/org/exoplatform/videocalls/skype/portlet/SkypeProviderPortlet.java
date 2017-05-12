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
package org.exoplatform.videocalls.skype.portlet;

import static org.exoplatform.videocalls.VideoCallsUtils.asJSON;

import java.io.IOException;

import javax.portlet.GenericPortlet;
import javax.portlet.PortletException;
import javax.portlet.RenderRequest;
import javax.portlet.RenderResponse;

import org.exoplatform.container.ExoContainer;
import org.exoplatform.container.ExoContainerContext;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.videocalls.VideoCallsService;
import org.exoplatform.videocalls.skype.SkypeProvider;
import org.exoplatform.videocalls.skype.SkypeSettings;
import org.exoplatform.web.application.JavascriptManager;
import org.exoplatform.webui.application.WebuiRequestContext;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeProviderPortlet.java 00000 Mar 29, 2017 pnedonosko $
 */
public class SkypeProviderPortlet extends GenericPortlet {

  /** The Constant LOG. */
  private static final Log  LOG = ExoLogger.getLogger(SkypeProviderPortlet.class);

  /** The video calls. */
  private VideoCallsService videoCalls;

  /** The provider. */
  private SkypeProvider     provider;

  /**
   * {@inheritDoc}
   */
  @Override
  public void init() throws PortletException {
    super.init();

    ExoContainer container = ExoContainerContext.getCurrentContainer();
    this.videoCalls = container.getComponentInstanceOfType(VideoCallsService.class);
    try {
      this.provider = (SkypeProvider) videoCalls.getProvider(SkypeProvider.SKYPE_TYPE);
    } catch (ClassCastException e) {
      LOG.error("Provider " + SkypeProvider.SKYPE_TYPE + " isn't an instance of "
          + SkypeProvider.class.getName(), e);
    }
  }

  /**
   * {@inheritDoc}
   */
  @Override
  protected void doView(final RenderRequest request, final RenderResponse response) throws PortletException,
                                                                                    IOException {
    if (this.provider != null) {
      try {
        SkypeSettings settings = provider.getSettings().build();
        String settingsJson = asJSON(settings);

        JavascriptManager js =
                             ((WebuiRequestContext) WebuiRequestContext.getCurrentInstance()).getJavascriptManager();
        js.require("SHARED/videoCalls", "videoCalls")
          .require("SHARED/videoCalls_skype", "skypeProvider")
          .addScripts("skypeProvider.configure(" + settingsJson
              + "); videoCalls.addProvider(skypeProvider); videoCalls.update();");
      } catch (Exception e) {
        LOG.error("Error processing Skype Calls portlet for user " + request.getRemoteUser(), e);
      }
    }
  }
}
