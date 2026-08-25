package com.yxzq.openapi.https.utils;

import org.apache.commons.lang3.StringUtils;
import org.apache.http.*;
import org.apache.http.client.HttpClient;
import org.apache.http.client.entity.GzipDecompressingEntity;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.params.ClientPNames;
import org.apache.http.conn.params.ConnRoutePNames;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.message.BasicNameValuePair;
import org.apache.http.params.CoreConnectionPNames;
import org.apache.http.protocol.HttpContext;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.concurrent.ConcurrentHashMap;


/**
 * HttpClientUtil
 */
public class HttpClientUtil {

    private static final Logger logger = LoggerFactory.getLogger(HttpClientUtil.class);
    private static final ThreadLocal<Map<String, SNHttpClient>> threadLocal = new ThreadLocal<>();
    private static final long expiredTime = 900000L;
    private static long lastCloseTime = 0;
    private static long interval = 1 * 60 * 1000;

    private static final boolean isEmptyCollection(Map<?, ?> collection) {
        return (collection == null || collection.isEmpty());
    }

    public static final String post(String url, Map<String, String> params, Map<String, String> headers, Charset charset, boolean... releaseConnnection) {
        String res = post(null, url, params, headers, charset, releaseConnnection);
        return res;
    }

    public static final String postJson(String url, String json, Map<String, String> headers, Charset charset, boolean... releaseConnnection) {
        String res = postJson(null, url, json, headers, charset, releaseConnnection);
        return res;
    }

    public static final String post(HttpHost proxy, String url, Map<String, String> params, Map<String, String> headers, Charset charset, boolean... releaseConnnection) {
        HttpResponse response = null;
        String content = null;
        try {
            response = post4Response(proxy, url, params, headers, charset);
            content = EntityUtils.toString(response.getEntity(), charset);
        } catch (IOException e) {
            closeHttpClient(url);
            throw handlerException("http post for html(proxy=" + proxy + ",url=" + url + ",params=" + params + ",headers=" + headers + ")", e);
        } finally {
            closeResponse(response);
            if (releaseConnnection.length == 0 || releaseConnnection[0]) {
                closeHttpClient(url);
            }
        }
        if (logger.isDebugEnabled()) {
            logger.debug("url=" + url + ",res=" + content);
        }
        return content;
    }

    public static final String postJson(HttpHost proxy, String url, String json, Map<String, String> headers, Charset charset, boolean... releaseConnnection) {
        HttpResponse response = null;
        try {
            response = postJsonResponse(proxy, url, json, headers, charset);
            String content = EntityUtils.toString(response.getEntity(), charset);
            if (logger.isDebugEnabled()) {
                logger.debug("url=" + url + ",res=" + content);
            }
            return content;
        } catch (Exception e) {
            closeHttpClient(url);
            throw handlerException("post json(proxy=" + proxy + ",url=" + url + ",params=" + json + ",headers=" + headers + ")", e);
        } finally {
            closeResponse(response);
            if (releaseConnnection.length == 0 || releaseConnnection[0]) {
                closeHttpClient(url);
            }
        }
    }

    public static final HttpResponse post4Response(HttpHost proxy, String url, Map<String, String> params, Map<String, String> headers, Charset charset) {
        HttpResponse response = null;
        try {
            HttpClient client = getHttpClient(url);
            if (proxy != null) {
                client.getParams().setParameter(ConnRoutePNames.DEFAULT_PROXY, proxy);
            }
            HttpPost post = new HttpPost(url);
            if (!isEmptyCollection(params)) {
                post.setEntity(new UrlEncodedFormEntity(getNameValuePairsFromMap(params), charset));
            }

            if (headers != null) {
                for (Entry<String, String> header : headers.entrySet()) {
                    post.setHeader(header.getKey(), header.getValue());
                }
            }
            response = client.execute(post);
            if (logger.isDebugEnabled()) {
                logger.debug("url=" + url + ",response=" + response);
            }
            return response;
        } catch (IOException e) {
            closeHttpClient(url);
            closeResponse(response);
            throw handlerException("post to response(proxy=" + proxy + ",url=" + url + ",params=" + params + ",headers=" + headers + ")", e);
        }
    }

    public static final HttpResponse postJsonResponse(HttpHost proxy, String url, String json, Map<String, String> headers, Charset charset) {
        HttpResponse response = null;
        try {
            DefaultHttpClient client = getHttpClient(url);


            if (proxy != null) {
                client.getParams().setParameter(ConnRoutePNames.DEFAULT_PROXY, proxy);
            }

            HttpPost post = new HttpPost(url);
            if (StringUtils.isNotEmpty(json)) {
                StringEntity se = new StringEntity(json, charset);
                se.setContentType(ContentType.APPLICATION_JSON.getMimeType());
                post.setEntity(se);
            }

            if (headers != null) {
                for (Entry<String, String> header : headers.entrySet()) {
                    post.setHeader(header.getKey(), header.getValue());
                }
            }
            response = client.execute(post);
            if (logger.isDebugEnabled()) {
                logger.debug("url=" + url + ",params=" + json + ",response=" + response);
            }
            return response;
        } catch (IOException e) {
            closeHttpClient(url);
            closeResponse(response);
            throw handlerException("post json response(proxy=" + proxy + ",url=" + url + ",params=" + json + ",headers=" + headers + ")", e);
        }
    }

    /**
     * 设置参数
     *
     * @param params
     * @return
     */
    private static final List<NameValuePair> getNameValuePairsFromMap(Map<String, String> params) {
        List<NameValuePair> pairs = new ArrayList<NameValuePair>();
        if (!isEmptyCollection(params)) {
            for (Entry<String, String> e : params.entrySet()) {
                pairs.add(new BasicNameValuePair(e.getKey(), e.getValue()));
            }
        }
        return pairs;
    }

    /**
     * 获取host
     *
     * @param url
     * @return
     */
    public static final String getHostAndPort(String url) {
        String host = url;
        if (url.startsWith("http://")) {
            host = url.substring(7);
        }
        if (host.contains("/")) {
            host = host.substring(0, host.indexOf("/"));
        }
        if (logger.isDebugEnabled()) {
            logger.debug(url + ">>>host>>>" + host);
        }
        return host;
    }

    private static final boolean isExpired(SNHttpClient SNHttpClient) {
        return System.currentTimeMillis() - SNHttpClient.getAccessTime() > expiredTime;
    }

    private final static void checkAndProcessConnections() {
        final Map<String, SNHttpClient> clients = threadLocal.get();
        if (clients != null && System.currentTimeMillis() - lastCloseTime > interval) {
            //启动线程，关闭过期的连接
            new Thread(new Runnable() {
                @Override
                public void run() {
                    lastCloseTime = System.currentTimeMillis();
                    for (Entry<String, SNHttpClient> en : clients.entrySet()) {
                        SNHttpClient c = en.getValue();
                        c.getHttpClient().getConnectionManager().closeExpiredConnections();
                        if (logger.isDebugEnabled()) {
                            logger.debug("close expired connections.");
                        }
                    }
                }
            }).start();
        }
    }

    private static final RuntimeException handlerException(String msg, Exception exception) {
        return new RuntimeException(msg, exception);
    }

    /**
     * use BasicClientConnectionManager to get connections
     *
     * @param
     * @return
     */
    private static final DefaultHttpClient getHttpClient(String url) {
        checkAndProcessConnections();
        String host = getHostAndPort(url);
        Map<String, SNHttpClient> clients = threadLocal.get();
        if (clients == null) {
            clients = new ConcurrentHashMap<String, SNHttpClient>();
            threadLocal.set(clients);
        }
        SNHttpClient snClient = clients.get(host);
        if (snClient == null) {
            snClient = new SNHttpClient();
        }
        boolean fromCache = true;
        DefaultHttpClient client = snClient.getHttpClient();

        if (client == null || isExpired(snClient)) {
            client = new DefaultHttpClient();
            fromCache = false;
            client.getParams().setParameter(CoreConnectionPNames.CONNECTION_TIMEOUT, 20000);
            client.getParams().setParameter(CoreConnectionPNames.SO_TIMEOUT, 50000);
            client.getParams().setParameter(CoreConnectionPNames.SO_KEEPALIVE, true);
            client.getParams().setParameter(ClientPNames.ALLOW_CIRCULAR_REDIRECTS, true);

            snClient.setHttpClient(client);
            clients.put(host, snClient);
        } else {
            client = snClient.getHttpClient();
        }

        client.addResponseInterceptor(new HttpResponseInterceptor() {
            @Override
            public void process(final HttpResponse response, final HttpContext context) throws HttpException, IOException {
                HttpEntity entity = response.getEntity();
                Header ceheader = entity.getContentEncoding();
                if (ceheader != null) {
                    HeaderElement[] codecs = ceheader.getElements();
                    for (int i = 0; i < codecs.length; i++) {
                        if ("gzip".equalsIgnoreCase(codecs[i].getName())) {
                            response.setEntity(new GzipDecompressingEntity(response.getEntity()));
                            return;
                        }
                    }
                }
            }
        });

        snClient.setAccessTime(System.currentTimeMillis());
        if (fromCache) {
            if (logger.isDebugEnabled()) {
                logger.debug("get httpClient[" + client + "] from cache.===current thread cache route's size=" + clients.size());
            }
        } else {
            if (logger.isDebugEnabled()) {
                logger.debug("new httpClient[" + client + "].===current thread cache route's size=" + clients.size());
            }
        }
        return client;
    }

    /**
     * 关闭连接
     *
     * @param url
     */
    public static final void closeHttpClient(String url) {
        String host = getHostAndPort(url);
        Map<String, SNHttpClient> httpClients = threadLocal.get();
        HttpClient client = null;
        if (httpClients != null) {
            SNHttpClient SNHttpClient = httpClients.get(host);
            if (SNHttpClient != null) {
                client = SNHttpClient.getHttpClient();
                client.getConnectionManager().shutdown();
            }
            httpClients.remove(host);
            if (logger.isDebugEnabled()) {
                logger.debug("shutdown httpClient[" + client + "].===current thread cache route's size=" + httpClients.size());
            }
        }
    }

    public static final void closeResponse(HttpResponse response) {
        if (response != null && response.getEntity() != null) {
            try {
                response.getEntity().getContent().close();
            } catch (Exception e) {
                logger.error(String.valueOf(e));
            }
        }
    }

    static class SNHttpClient {
        private DefaultHttpClient httpClient;
        private long accessTime;

        public DefaultHttpClient getHttpClient() {
            return httpClient;
        }

        public void setHttpClient(DefaultHttpClient httpClient) {
            this.httpClient = httpClient;
        }

        public long getAccessTime() {
            return accessTime;
        }

        public void setAccessTime(long accessTime) {
            this.accessTime = accessTime;
        }
    }
}
