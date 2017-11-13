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

import java.util.List;

import org.exoplatform.container.configuration.ConfigurationException;
import org.exoplatform.container.xml.InitParams;
import org.exoplatform.container.xml.ValuesParam;
import org.exoplatform.social.core.profile.settings.IMType;
import org.exoplatform.social.core.profile.settings.UserProfileSettingsService;
import org.exoplatform.webconferencing.UserInfo.IMInfo;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeProvider.java 00000 Mar 30, 2017 pnedonosko $
 */
public class SkypeBusinessProvider extends SkypeProvider {

  /** The Constant CONFIG_AUTODISCOVER_ORIGINS. */
  public static final String CONFIG_AUTODISCOVER_ORIGINS      = "autodiscover-origins";

  /** The Constant CONFIG_WEB_APPVERSION. */
  public static final String CONFIG_WEB_APPVERSION            = "web-oauth2-appVersion";

  /** The Constant CONFIG_WEB_OAUTH2_URL. */
  public static final String CONFIG_WEB_OAUTH2_URL            = "web-oauth2-loginUri";

  /** The Constant CONFIG_WEB_OAUTH2_CLIENTID. */
  public static final String CONFIG_WEB_OAUTH2_CLIENTID       = "web-oauth2-clientId";

  /** The Constant CONFIG_WEB_APIKEY. */
  public static final String CONFIG_WEB_APIKEY                = "web-apiKey";

  /** The Constant CONFIG_WEB_APIKEYCC. */
  public static final String CONFIG_WEB_APIKEYCC              = "web-apiKeyCC";

  /** The Constant SFB_SCHEMA. */
  public static final String SFB_SCHEMA                       = "ms-sfb";

  /** The Constant SFB_TYPE. */
  public static final String SFB_TYPE                         = "mssfb";

  /** The Constant SFB_TITLE. */
  public static final String SFB_TITLE                        = "Skype for Business";

  /** The Constant SFB_AUTODISCOVER_ORIGINS_DEFAULT. */
  public static final String SFB_AUTODISCOVER_ORIGINS_DEFAULT = "https://webdir.online.lync.com/AutoDiscover/AutoDiscoverservice.svc/root";

  /**
   * The Class WebSettingsBuilder.
   */
  public class WebSettingsBuilder extends SettingsBuilder {

    /**
     * {@inheritDoc}
     */
    @Override
    public SkypeSettings build() {
      return new SkypeSettings(getType(),
                               getSupportedTypes(),
                               getTitle(),
                               "Call", // TODO in18n
                               "Join", // TODO in18n
                               getClientId(),
                               redirectURI,
                               getVersion(),
                               getApiKey(),
                               getApiKeyCC(),
                               origins);
    }
  }

  /**
   * The Class SkypeBusinessIMInfo.
   */
  public class SkypeBusinessIMInfo extends SkypeIMInfo {

    /**
     * Instantiates a new SfB IM info.
     *
     * @param id the id
     */
    protected SkypeBusinessIMInfo(String id) {
      super(SFB_TYPE, id);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getSchema() {
      return SFB_SCHEMA;
    }

    /**
     * Checks if is business.
     *
     * @return true, if is business
     */
    public boolean isBusiness() {
      return true;
    }
  }

  /** The login url. */
  protected final String   loginUrl;

  /** The client id (application ID in AD). */
  protected final String   clientId;

  /** The api key. */
  protected final String   apiKey;

  /** The api key CC. */
  protected final String   apiKeyCC;

  /** The origins. */
  protected final String[] origins;

  /** The version. */
  protected final String   version;

  /**
   * Instantiates a new Skype for Business provider.
   *
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public SkypeBusinessProvider(/* SkypeService skypeService, */ InitParams params) throws ConfigurationException {
    this(null, params);
  }

  /**
   * Instantiates a new Skype for Business provider.
   *
   * @param profileSettings the profile settings
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public SkypeBusinessProvider(UserProfileSettingsService profileSettings, InitParams params) throws ConfigurationException {
    super(params);

    String version = this.config.get(CONFIG_WEB_APPVERSION);
    if (version == null || (version = version.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_APPVERSION + " required and should be non empty.");
    }
    this.version = version;

    String loginUrl = this.config.get(CONFIG_WEB_OAUTH2_URL);
    if (loginUrl == null || (loginUrl = loginUrl.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_OAUTH2_URL + " required and should be non empty.");
    }
    this.loginUrl = loginUrl;

    String clientId = this.config.get(CONFIG_WEB_OAUTH2_CLIENTID);
    if (clientId == null || (clientId = clientId.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_OAUTH2_CLIENTID + " required and should be non empty.");
    }
    this.clientId = clientId;

    String apiKey = this.config.get(CONFIG_WEB_APIKEY);
    if (apiKey == null || (apiKey = apiKey.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_APIKEY + " required and should be non empty.");
    }
    this.apiKey = apiKey;

    String apiKeyCC = this.config.get(CONFIG_WEB_APIKEYCC);
    if (apiKeyCC == null || (apiKeyCC = apiKeyCC.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_APIKEYCC + " required and should be non empty.");
    }
    this.apiKeyCC = apiKeyCC;

    ValuesParam originsParams = params.getValuesParam(CONFIG_AUTODISCOVER_ORIGINS);
    if (originsParams != null) {
      List<String> values = originsParams.getValues();
      origins = new String[values.size()]; // + 1
      for (int i = 0; i < values.size(); i++) {
        origins[i] = values.get(i);
      }
      // XXX not required since Apr 14, 2017
      // As suggested in
      // http://stackoverflow.com/questions/43345355/skype-web-sdk-only-one-server-https-webdir1e-online-lync-com-is-correctl
      // use exact server URL in autodiscovery until it will be fixed by Microsoft
      // origins[origins.length
      // - 1] = "https://webdir1e.online.lync.com/Autodiscover/AutodiscoverService.svc/root";
    } else {
      origins = new String[] { SFB_AUTODISCOVER_ORIGINS_DEFAULT };
    }

    if (profileSettings != null) {
      // add plugin programmatically as it's an integral part of the provider
      profileSettings.addIMType(new IMType(SFB_TYPE, SFB_TITLE));
    }
  }

  /**
   * {@inheritDoc}
   */
  public WebSettingsBuilder settings() {
    return new WebSettingsBuilder();
  }

  /**
   * Gets the origins.
   *
   * @return the origins
   */
  public String[] getOrigins() {
    String[] copy = new String[origins.length];
    System.arraycopy(origins, 0, copy, 0, origins.length);
    return copy;
  }

  /**
   * Gets the login url.
   *
   * @return the login url
   */
  public String getLoginUrl() {
    return loginUrl;
  }

  /**
   * Gets the client id.
   *
   * @return the client id
   */
  public String getClientId() {
    return clientId;
  }

  /**
   * Gets the api key.
   *
   * @return the api key
   */
  public String getApiKey() {
    return apiKey;
  }

  /**
   * Gets the api key CC.
   *
   * @return the api key CC
   */
  public String getApiKeyCC() {
    return apiKeyCC;
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public IMInfo getIMInfo(String imId) {
    // Person ID in SfB should start with sip:
    // TODO what about other schemes business: msteams: skype: live: im:
    int colonIndex = imId.indexOf(":");
    int atIndex = imId.indexOf("@");
    int slashIndex = imId.indexOf("/");
    if (colonIndex > 0) {
      if ((atIndex > 0 ? colonIndex < atIndex : true) && (slashIndex > 0 ? colonIndex < slashIndex : true)) {
        // It seems the ID already has a scheme
      } else if (!imId.startsWith("sip:")) {
        // If not starts with sip: then add it - a colon
        imId = "sip:" + imId;
      }
    } else if (colonIndex == 0) {
      // XXX Is it true assumption?
      imId = "sip" + imId;
    } else {
      // Otherwise prepend with sip:
      imId = "sip:" + imId;
    }
    return new SkypeBusinessIMInfo(imId);
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public String getType() {
    return SFB_TYPE;
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public String getTitle() {
    return SFB_TITLE;
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public String getVersion() {
    return version;
  }

}
