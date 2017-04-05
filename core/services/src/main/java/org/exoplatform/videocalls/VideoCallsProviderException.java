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

// TODO: Auto-generated Javadoc
/**
 * VideoCalls provider exception.
 * 
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: VideoCallsProviderException.java 00000 Mar 30, 2017 pnedonosko $
 * 
 */
public class VideoCallsProviderException extends Exception {

  /** The Constant serialVersionUID. */
  private static final long serialVersionUID = 1721124032491196348L;

  /**
   * Instantiates a new video calls provider exception.
   */
  public VideoCallsProviderException() {
    //
  }

  /**
   * Instantiates a new video calls provider exception.
   *
   * @param message the message
   */
  public VideoCallsProviderException(String message) {
    super(message);
  }

  /**
   * Instantiates a new video calls provider exception.
   *
   * @param cause the cause
   */
  public VideoCallsProviderException(Throwable cause) {
    super(cause);
  }

  /**
   * Instantiates a new video calls provider exception.
   *
   * @param message the message
   * @param cause the cause
   */
  public VideoCallsProviderException(String message, Throwable cause) {
    super(message, cause);
  }

  /**
   * Instantiates a new video calls provider exception.
   *
   * @param message the message
   * @param cause the cause
   * @param enableSuppression the enable suppression
   * @param writableStackTrace the writable stack trace
   */
  public VideoCallsProviderException(String message,
                                     Throwable cause,
                                     boolean enableSuppression,
                                     boolean writableStackTrace) {
    super(message, cause, enableSuppression, writableStackTrace);
  }

}
