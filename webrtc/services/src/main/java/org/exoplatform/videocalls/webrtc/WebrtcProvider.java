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
package org.exoplatform.videocalls.webrtc;

import org.exoplatform.container.configuration.ConfigurationException;
import org.exoplatform.container.xml.InitParams;
import org.exoplatform.social.core.profile.settings.IMType;
import org.exoplatform.social.core.profile.settings.UserProfileSettingsService;
import org.exoplatform.videocalls.UserInfo.IMInfo;
import org.exoplatform.videocalls.VideoCallsProvider;
import org.exoplatform.videocalls.VideoCallsProviderException;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: WebrtcProvider.java 00000 Aug 15, 2017 pnedonosko $
 */
public class WebrtcProvider extends VideoCallsProvider {

  /** The Constant WEBRTC_TYPE. */
  public static final String WEBRTC_TYPE  = "webrtc";

  /** The Constant WEBRTC_TITLE. */
  public static final String WEBRTC_TITLE = "WebRTC";

  /** The Constant VERSION. */
  public static final String VERSION      = "1.0.0";

  /**
   * The Class SettingsBuilder.
   */
  public class SettingsBuilder {

    /** The call URI. */
    protected String callURI;

    /**
     * Call URI.
     *
     * @param callURI the call URI
     * @return the settings builder
     */
    public SettingsBuilder callURI(String callURI) {
      this.callURI = callURI;
      return this;
    }

    /**
     * Builds the WebRTC settings.
     *
     * @return the WebRTC settings
     */
    public WebrtcSettings build() {
      return new WebrtcSettings(getType(),
                                getSupportedTypes(),
                                getTitle(),
                                "Call", // TODO in18n
                                "Join", // TODO in18n
                                getVersion(),
                                callURI);
    }
  }

  /**
   * The Class WebrtcIMInfo.
   */
  public class WebrtcIMInfo extends IMInfo {

    /**
     * Instantiates a new webrtc IM info.
     *
     * @param id the id
     */
    protected WebrtcIMInfo(String id) {
      this(WEBRTC_TYPE, id);
    }

    /**
     * Instantiates a new WebRTC IM info.
     *
     * @param type the type
     * @param id the id
     */
    protected WebrtcIMInfo(String type, String id) {
      super(type, id);
    }
  }

  /**
   * Instantiates a new WebRTC provider.
   *
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public WebrtcProvider(InitParams params) throws ConfigurationException {
    this(null, params);
  }

  /**
   * Instantiates a new WebRTC provider.
   *
   * @param profileSettings the profile settings
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public WebrtcProvider(UserProfileSettingsService profileSettings, InitParams params)
      throws ConfigurationException {
    super(params);
    if (profileSettings != null) {
      // add plugin programmatically as it's an integral part of the provider
      profileSettings.addIMType(new IMType(WEBRTC_TYPE, WEBRTC_TITLE));
    }
  }

  /**
   * Gets the settings.
   *
   * @return the settings
   */
  public SettingsBuilder settings() {
    return new SettingsBuilder();
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public IMInfo getIMInfo(String imId) throws VideoCallsProviderException {
    return new WebrtcIMInfo(imId);
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public String getVersion() {
    return VERSION;
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public String getType() {
    return WEBRTC_TYPE;
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public String[] getSupportedTypes() {
    return new String[] { getType() };
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public String getTitle() {
    return WEBRTC_TITLE;
  }

}
