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
package org.exoplatform.webconferencing.skype;

import org.exoplatform.container.configuration.ConfigurationException;
import org.exoplatform.container.xml.InitParams;
import org.exoplatform.social.core.profile.settings.IMType;
import org.exoplatform.social.core.profile.settings.UserProfileSettingsService;
import org.exoplatform.webconferencing.CallProvider;
import org.exoplatform.webconferencing.UserInfo.IMInfo;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeProvider.java 00000 Mar 30, 2017 pnedonosko $
 */
public class SkypeProvider extends CallProvider {

  /** The Constant SKYPE_SCHEMA. */
  public static final String  SKYPE_SCHEMA  = "skype";

  /** The Constant SKYPE_TYPE. */
  public static final String  SKYPE_TYPE    = SKYPE_SCHEMA;

  /** The Constant SKYPE_TITLE. */
  public static final String  SKYPE_APPNAME = "eXoURISkype";

  /** The Constant SKYPE_TITLE. */
  public static final String  SKYPE_TITLE   = "Skype";

  /** The Constant VERSION. */
  private static final String VERSION       = SKYPE_APPNAME + "/1.0.0";

  /**
   * Skype and Skype for Business settings.
   */
  public class SkypeSettings extends Settings {

    /** The redirect uri. */
    protected final String redirectUri;

    /**
     * Instantiates a new skype settings.
     *
     * @param redirectUri the redirect uri
     */
    protected SkypeSettings(String redirectUri) {
      this.redirectUri = redirectUri;
    }

    /**
     * Gets the redirect uri.
     *
     * @return the redirect uri
     */
    public String getRedirectUri() {
      return redirectUri;
    }
  }

  /**
   * The Class SettingsBuilder.
   */
  public class SettingsBuilder {

    /** The redirect URI. */
    protected String redirectURI;

    /**
     * Redirect URI.
     *
     * @param redirectURI the redirect URI
     * @return the settings builder
     */
    public SettingsBuilder redirectURI(String redirectURI) {
      this.redirectURI = redirectURI;

      return this;
    }

    /**
     * Builds the.
     *
     * @return the skype settings
     */
    public SkypeSettings build() {
      return new SkypeSettings(redirectURI);
    }
  }

  /**
   * The Class SkypeIMInfo.
   */
  public class SkypeIMInfo extends IMInfo {

    /**
     * Instantiates a new skype IM info.
     *
     * @param id the id
     */
    protected SkypeIMInfo(String id) {
      this(SKYPE_TYPE, id);
    }

    /**
     * Instantiates a new skype IM info.
     *
     * @param type the type
     * @param id the id
     */
    protected SkypeIMInfo(String type, String id) {
      super(type, id);
    }

    /**
     * Gets the schema.
     *
     * @return the schema
     */
    public String getSchema() {
      return SKYPE_SCHEMA;
    }

    /**
     * Checks if is business.
     *
     * @return true, if is business
     */
    public boolean isBusiness() {
      return false;
    }
  }

  /**
   * Instantiates a new skype provider.
   *
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public SkypeProvider(InitParams params) throws ConfigurationException {
    this(null, params);
  }

  /**
   * Instantiates a new skype provider.
   *
   * @param profileSettings the profile settings
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public SkypeProvider(UserProfileSettingsService profileSettings, InitParams params) throws ConfigurationException {
    super(params);
    // this.skypeService = skypeService;
    if (profileSettings != null) {
      // add plugin programmatically as it's an integral part of the provider
      profileSettings.addIMType(new IMType(SKYPE_TYPE, SKYPE_TITLE));
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
  public IMInfo getIMInfo(String imId) {
    return new SkypeIMInfo(imId);
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
    return SKYPE_TYPE;
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
    return SKYPE_TITLE;
  }

}
