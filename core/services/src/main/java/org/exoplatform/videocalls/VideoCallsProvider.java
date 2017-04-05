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
package org.exoplatform.videocalls;

import java.util.Collections;
import java.util.Map;
import java.util.regex.Pattern;

import org.exoplatform.container.component.BaseComponentPlugin;
import org.exoplatform.container.configuration.ConfigurationException;
import org.exoplatform.container.xml.InitParams;
import org.exoplatform.container.xml.PropertiesParam;
import org.exoplatform.videocalls.UserInfo.IMInfo;

// TODO: Auto-generated Javadoc
/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: VideoCallsProvider.java 00000 Mar 30, 2017 pnedonosko $
 */
public abstract class VideoCallsProvider extends BaseComponentPlugin {

  /** The Constant CONFIG_PROVIDER_TYPE. */
  public static final String          CONFIG_PROVIDER_TYPE          = "type";

  /** The Constant CONFIG_PROVIDER_NAME. */
  public static final String          CONFIG_PROVIDER_NAME          = "name";

  /** The Constant CONFIG_PROVIDER_CONFIGURATION. */
  public static final String          CONFIG_PROVIDER_CONFIGURATION = "provider-configuration";

  /** The Constant EMAIL_REGEX. */
  protected static final String       EMAIL_REGEX                   =
                                                  "^(?=[A-Z0-9][A-Z0-9@._%+-]{5,253}+$)[A-Z0-9._%+-]{1,64}+@(?:(?=[A-Z0-9-]{1,63}+\\.)[A-Z0-9]++(?:-[A-Z0-9]++)*+\\.){1,8}+[A-Z]{2,63}+$";

  /** The email test. */
  protected final Pattern             emailTest                     =
                                                Pattern.compile(EMAIL_REGEX,
                                                                Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

  /** The config. */
  protected final Map<String, String> config;

  /**
   * Instantiates a new video calls provider.
   *
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public VideoCallsProvider(InitParams params) throws ConfigurationException {
    // Configuration
    PropertiesParam param = params.getPropertiesParam(CONFIG_PROVIDER_CONFIGURATION);
    if (param != null) {
      this.config = Collections.unmodifiableMap(param.getProperties());
    } else {
      throw new ConfigurationException("Property parameters provider-configuration required.");
    }
  }

  /**
   * Gets the type name of this provider (e.g. 'skype'). Provider type should be in lower case and without
   * white spaces.
   *
   * @return the type
   */
  public abstract String getType();

  /**
   * Gets human-readable name of this provider (e.g. 'Skype'). Provider name can be used in building UI
   * labels and messages.
   *
   * @return the name
   */
  public abstract String getTitle();
  
  /**
   * Gets the version.
   *
   * @return the version
   */
  public abstract String getVersion();

  /**
   * Checks if it is a supported type by this provider.
   *
   * @param type the type
   * @return <code>true</code>, if is supported type, <code>false</code> otherwise
   */
  public boolean isSupportedType(String type) {
    return getType().equals(type);
  }

  /**
   * Gets the {@link IMInfo} instance for given IM identifier.
   *
   * @param imId the IM identifier
   * @return the {@link IMInfo} instance
   * @throws VideoCallsProviderException if the provider cannot recognize given IM id or failed to instantiate
   *           an {@link IMInfo} object
   */
  public abstract IMInfo getIMInfo(String imId) throws VideoCallsProviderException;

}
