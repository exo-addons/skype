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
package org.exoplatform.webconferencing.skype.portlet;

import static org.exoplatform.webconferencing.Utils.asJSON;

import java.io.IOException;
import java.net.URI;

import javax.portlet.GenericPortlet;
import javax.portlet.PortletException;
import javax.portlet.RenderRequest;
import javax.portlet.RenderResponse;

import org.exoplatform.container.ExoContainer;
import org.exoplatform.container.ExoContainerContext;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.social.core.space.spi.SpaceService;
import org.exoplatform.web.application.JavascriptManager;
import org.exoplatform.webconferencing.WebConferencingService;
import org.exoplatform.webconferencing.skype.SkypeBusinessProvider;
import org.exoplatform.webconferencing.skype.SkypeProvider.SkypeSettings;
import org.exoplatform.webui.application.WebuiRequestContext;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeProviderPortlet.java 00000 Mar 29, 2017 pnedonosko $
 */
public class SkypeBusinessProviderPortlet extends GenericPortlet {

  /** The Constant LOG. */
  private static final Log       LOG = ExoLogger.getLogger(SkypeBusinessProviderPortlet.class);

  /** The space service. */
  private SpaceService           spaceService;

  /** The video calls. */
  private WebConferencingService webConferencing;

  /** The provider. */
  private SkypeBusinessProvider  provider;

  /**
   * {@inheritDoc}
   */
  @Override
  public void init() throws PortletException {
    super.init();

    //
    ExoContainer container = ExoContainerContext.getCurrentContainer();

    this.spaceService = container.getComponentInstanceOfType(SpaceService.class);
    this.webConferencing = container.getComponentInstanceOfType(WebConferencingService.class);

    try {
      this.provider = (SkypeBusinessProvider) webConferencing.getProvider(SkypeBusinessProvider.SFB_TYPE);
    } catch (ClassCastException e) {
      LOG.error("Provider " + SkypeBusinessProvider.SFB_TYPE + " isn't an instance of " + SkypeBusinessProvider.class.getName(), e);
    }
  }

  /**
   * {@inheritDoc}
   */
  @Override
  protected void doView(final RenderRequest request, final RenderResponse response) throws PortletException, IOException {
    if (this.provider != null) {
      try {
        URI redirectURI = new URI(request.getScheme(), null, request.getServerName(), request.getServerPort(), "/portal/skype/call", null, null);
        SkypeSettings settings = provider.settings().redirectURI(redirectURI.toString()).build();
        String settingsJson = asJSON(settings);

        JavascriptManager js = ((WebuiRequestContext) WebuiRequestContext.getCurrentInstance()).getJavascriptManager();
        js.require("SHARED/webConferencing", "webConferencing")
          .addScripts("\nwindow.require(['SHARED/webConferencing_mssfb'], function(mssfbProvider) {" + "if (mssfbProvider) { mssfbProvider.configure("
              + settingsJson + "); webConferencing.addProvider(mssfbProvider); webConferencing.update(); }" + "}, function(err) {"
              + "console.log('Error creating Skype For Business provider. Error loading module: ' + JSON.stringify(err));" + "});");
      } catch (Exception e) {
        LOG.error("Error processing Skype Calls portlet for user " + request.getRemoteUser(), e);
      }
    }
  }
}
