package com.yxzq.openapi.service.impl;


import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.yxzq.openapi.config.OpenApiConstants;
import com.yxzq.openapi.config.OpenApiUrl;
import com.yxzq.openapi.example.AutoLoginDemo;
import com.yxzq.openapi.https.request.OpenHttpRequest;
import com.yxzq.openapi.https.response.OpenHttpResponse;
import com.yxzq.openapi.https.utils.OkHttpUtil;
import com.yxzq.openapi.https.utils.RSAUtil;
import com.yxzq.openapi.service.OpenApiService;
import org.apache.commons.lang3.StringUtils;
import org.java_websocket.WebSocket;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft_6455;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class OpenApiServiceImpl implements OpenApiService {

    private static final Logger logger = LoggerFactory.getLogger(OpenApiServiceImpl.class);


    WebSocketClient client;

    OkHttpUtil okHttpUtil = new OkHttpUtil();


    //全局 token
    String token = "";

    //登陆验证码
    String captcha = "";

    //委托单号
    String entrustId = "";

    Long X_Time = System.currentTimeMillis() / 1000;

    @Override
    public OpenHttpResponse autologin(OpenHttpRequest openHttpRequest) {
        String phoneNumber = RSAUtil.encrypt((openHttpRequest.getParameters()).get("phoneNumber").toString());
        String password = RSAUtil.encrypt((openHttpRequest.getParameters()).get("password").toString());
        String XSign = "";
        String json = "";

        JSONObject jsonObj = new JSONObject();
        OpenHttpResponse openHttpResponse = new OpenHttpResponse();
        Map<String, String> httpPost = new HashMap<>();
        jsonObj.put("phoneNumber", phoneNumber);
        jsonObj.put("password", password);
        jsonObj.put("areaCode", OpenApiConstants.areaCode);
        json = jsonObj.toString();
        JSONObject jsonObject_login = null;
        try {
            XSign = RSAUtil.sign(json, null);

            //公共属性
            httpPost.put("Content-type", OpenApiConstants.Content_type);
            httpPost.put("X-Lang", OpenApiConstants.X_Lang);
            httpPost.put("X-Channel", OpenApiConstants.X_Channel);
            httpPost.put("X-Dt", OpenApiConstants.X_Dt);
            httpPost.put("X-Type", OpenApiConstants.X_Type);
            httpPost.put("X-Sign", XSign);
            if (!StringUtils.isNotEmpty(token)) {
                String response_login = okHttpUtil.postData(OpenApiUrl.base_url_jy + openHttpRequest.getParameters().get("url").toString(), json, httpPost);
                jsonObject_login = JSON.parseObject(response_login);
                token = ((JSONObject) jsonObject_login.get("data")).get("token").toString();
                logger.info("自动登陆返回token对象：" + token);
                openHttpResponse.setData(jsonObject_login.get("data"));
            }
        } catch (Exception e) {
        }finally {
            openHttpResponse.setCode(jsonObject_login.get("code").toString());
            openHttpResponse.setMsg(jsonObject_login.get("msg").toString());
        }
        return openHttpResponse;
    }


    @Override
    public OpenHttpResponse openapi(OpenHttpRequest openHttpRequest) {
        String phoneNumber = "";
        String password = "";
        String passwordTrade = "";
        String XSign = "";
        String json = "";

        JSONObject jsonObj = new JSONObject();

        Map<String, String> httpPost = new HashMap<>();

        //公共属性
        httpPost.put("Content-type", OpenApiConstants.Content_type);
        httpPost.put("X-Lang", OpenApiConstants.X_Lang);
        httpPost.put("X-Channel", OpenApiConstants.X_Channel);
        httpPost.put("X-Dt", OpenApiConstants.X_Dt);
        httpPost.put("X-Type", OpenApiConstants.X_Type);

        OpenHttpResponse openHttpResponse = new OpenHttpResponse();
        try {
            switch (openHttpRequest.getParameters().get("url").toString()) {
                case OpenApiUrl.login:
                    phoneNumber = RSAUtil.encrypt((openHttpRequest.getParameters()).get("phoneNumber").toString());
                    password = RSAUtil.encrypt((openHttpRequest.getParameters()).get("password").toString());
                    jsonObj.put("phoneNumber", phoneNumber);
                    jsonObj.put("password", password);
                    jsonObj.put("areaCode", OpenApiConstants.areaCode);
                    jsonObj.put("captcha", openHttpRequest.getParameters().get("captcha").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("X-Sign", XSign);
                    break;
                case OpenApiUrl.send_phone_captcha:
                    phoneNumber = RSAUtil.encrypt((openHttpRequest.getParameters()).get("phoneNumber").toString());
                    jsonObj.put("phoneNumber", phoneNumber);
                    jsonObj.put("type", (openHttpRequest.getParameters()).get("type").toString());
                    jsonObj.put("areaCode", OpenApiConstants.areaCode);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.login_captcha:
                    JSONObject modifyUserConfigParam = new JSONObject();
//                    String modifyUserConfigParam = "{}";
//                    JSONObject modifyUserConfigParam1 = JSONObject.fromObject(modifyUserConfigParam);
                    modifyUserConfigParam.put("languageCn", "1");
                    modifyUserConfigParam.put("languageHk", "1");
                    modifyUserConfigParam.put("lineColorHk", "1");
                    phoneNumber = RSAUtil.encrypt((openHttpRequest.getParameters()).get("phoneNumber").toString());
                    jsonObj.put("areaCode", OpenApiConstants.areaCode);
                    jsonObj.put("phoneNumber", phoneNumber);
                    jsonObj.put("captcha", captcha);
                    jsonObj.put("modifyUserConfigParam", modifyUserConfigParam);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.check_trade_password:
                    passwordTrade = RSAUtil.encrypt((openHttpRequest.getParameters()).get("password").toString());
                    jsonObj.put("password", passwordTrade);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.reset_login_password:
                    phoneNumber = RSAUtil.encrypt((openHttpRequest.getParameters()).get("phoneNumber").toString());
                    password = RSAUtil.encrypt((openHttpRequest.getParameters()).get("password").toString());
                    jsonObj.put("password", password);
                    jsonObj.put("phoneNumber", phoneNumber);
                    jsonObj.put("phoneCaptcha", captcha);
                    jsonObj.put("areaCode", OpenApiConstants.areaCode);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.trade_login:
                    passwordTrade = RSAUtil.encrypt((openHttpRequest.getParameters()).get("password").toString());
                    jsonObj.put("password", passwordTrade);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.get_trade_status:
                    password = RSAUtil.encrypt((openHttpRequest.getParameters()).get("password").toString());
                    jsonObj.put("password", password);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.update_trade_password:
                    String newPassword = RSAUtil.encrypt((openHttpRequest.getParameters()).get("newPassword").toString());
                    passwordTrade = RSAUtil.encrypt((openHttpRequest.getParameters()).get("oldPassword").toString());
                    jsonObj.put("oldPassword", passwordTrade);
                    jsonObj.put("password", newPassword);
                    jsonObj.put("phoneCaptcha", captcha);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.update_login_password:
                    String newLoginPassword = RSAUtil.encrypt((openHttpRequest.getParameters()).get("newPassword").toString());
                    password = RSAUtil.encrypt((openHttpRequest.getParameters()).get("oldPassword").toString());
                    jsonObj.put("oldPassword", password);
                    jsonObj.put("password", newLoginPassword);
                    jsonObj.put("phoneCaptcha", captcha);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.get_user_stock_type:
                    jsonObj.put("marketType", (openHttpRequest.getParameters()).get("marketType").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.get_rate_by_fund_account:
                    jsonObj.put("fundAccount", (openHttpRequest.getParameters()).get("fundAccount").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.order:
                    passwordTrade = RSAUtil.encrypt((openHttpRequest.getParameters()).get("password").toString());
                    jsonObj.put("password", passwordTrade);
                    jsonObj.put("serialNo", (openHttpRequest.getParameters()).get("serialNo").toString());
                    jsonObj.put("entrustAmount", (openHttpRequest.getParameters()).get("entrustAmount").toString());
                    jsonObj.put("entrustPrice", (openHttpRequest.getParameters()).get("entrustPrice").toString());
                    jsonObj.put("entrustProp", (openHttpRequest.getParameters()).get("entrustProp").toString());
                    jsonObj.put("entrustType", (openHttpRequest.getParameters()).get("entrustType").toString());
                    jsonObj.put("exchangeType", (openHttpRequest.getParameters()).get("exchangeType").toString());
                    jsonObj.put("stockCode", (openHttpRequest.getParameters()).get("stockCode").toString());
                    jsonObj.put("stockName", (openHttpRequest.getParameters()).get("stockName").toString());
                    jsonObj.put("forceEntrustFlag", (openHttpRequest.getParameters()).get("forceEntrustFlag").toString());
                    jsonObj.put("sessionType", (openHttpRequest.getParameters()).get("sessionType").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.modify_order:
                    passwordTrade = RSAUtil.encrypt((openHttpRequest.getParameters()).get("password").toString());
                    jsonObj.put("password", passwordTrade);
                    jsonObj.put("actionType", (openHttpRequest.getParameters()).get("actionType").toString());
                    jsonObj.put("entrustAmount", (openHttpRequest.getParameters()).get("entrustAmount").toString());
                    jsonObj.put("entrustPrice", (openHttpRequest.getParameters()).get("entrustPrice").toString());
                    jsonObj.put("forceEntrustFlag", (openHttpRequest.getParameters()).get("forceEntrustFlag").toString());
                    jsonObj.put("entrustId", entrustId);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.modified_range:
                    jsonObj.put("newPrice", (openHttpRequest.getParameters()).get("newPrice").toString());
                    jsonObj.put("entrustId", entrustId);
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.odd_entrust:
                    jsonObj.put("entrustAmount", (openHttpRequest.getParameters()).get("entrustAmount"));
                    jsonObj.put("entrustPrice", (openHttpRequest.getParameters()).get("entrustPrice"));
                    jsonObj.put("entrustType", (openHttpRequest.getParameters()).get("entrustType"));
                    jsonObj.put("exchangeType", (openHttpRequest.getParameters()).get("exchangeType"));
                    jsonObj.put("stockCode", (openHttpRequest.getParameters()).get("stockCode").toString());

                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.ipo_list:
                    jsonObj.put("pageNum", (openHttpRequest.getParameters()).get("pageNum").toString());
                    jsonObj.put("pageSize", (openHttpRequest.getParameters()).get("pageSize").toString());
                    jsonObj.put("status", (openHttpRequest.getParameters()).get("status").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.ipo_info:
                    jsonObj.put("ipoId", (openHttpRequest.getParameters()).get("ipoId").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.apply_ipo:
                    jsonObj.put("ipoId", (openHttpRequest.getParameters()).get("ipoId").toString());
                    jsonObj.put("applyQuantity", (openHttpRequest.getParameters()).get("applyQuantity").toString());
                    jsonObj.put("applyType", (openHttpRequest.getParameters()).get("applyType").toString());
                    jsonObj.put("cash", (openHttpRequest.getParameters()).get("cash").toString());
                    jsonObj.put("serialNo", (openHttpRequest.getParameters()).get("serialNo").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.sign(json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
            }

            openHttpResponse = openapiimpl((openHttpRequest.getParameters()).get("url").toString(), json, httpPost);
            return openHttpResponse;
        } catch (Exception e) {
            openHttpResponse.setCode("1300105");
            openHttpResponse.setMsg("系统异常");
            return openHttpResponse;
        }
    }


    public OpenHttpResponse openapiimpl(String url, String json_login, Map<String, String> httpPost_login) throws Exception {

        OpenHttpResponse openHttpResponse = new OpenHttpResponse();
//        String response_login = HttpClientUtil.postJson(OpenApiUrl.base_url_jy + url, json_login, httpPost_login, null);
        String response_login = okHttpUtil.postData(OpenApiUrl.base_url_jy + url, json_login, httpPost_login);
        System.out.println("response_login返回对象 = " + response_login);
        com.alibaba.fastjson.JSONObject jsonObject_login = JSON.parseObject(response_login);
        openHttpResponse.setCode(jsonObject_login.get("code").toString());
        openHttpResponse.setMsg(jsonObject_login.get("msg").toString());
        if (openHttpResponse.getCode().equals("0")) {
            openHttpResponse.setData(jsonObject_login.get("data"));
        }
        try {
            switch (url) {
                case OpenApiUrl.login:
                    token = ((com.alibaba.fastjson.JSONObject) openHttpResponse.getData()).get("token").toString();
                    break;
                case OpenApiUrl.send_phone_captcha:
                    captcha = ((com.alibaba.fastjson.JSONObject) openHttpResponse.getData()).get("captcha").toString();
                    break;
                case OpenApiUrl.order:
                    entrustId = ((com.alibaba.fastjson.JSONObject) openHttpResponse.getData()).get("entrustId").toString();
                    break;
            }
        } catch (Exception e) {
        } finally {
            openHttpResponse.setCode(jsonObject_login.get("code").toString());
            openHttpResponse.setMsg(jsonObject_login.get("msg").toString());
            return openHttpResponse;
        }

    }

    @Override
    public OpenHttpResponse openapiHq(OpenHttpRequest openHttpRequest) {

        //自动登录获取 token
        if(!StringUtils.isNotEmpty(token)){
            token = ((JSONObject) AutoLoginDemo.login().getData()).get("token").toString();
        }
        String XSign = "";
        String json = "";

        JSONObject jsonObj = new JSONObject();
        Map<String, String> httpPost = new HashMap<>();

        //公共属性
        httpPost.put("Content-type", OpenApiConstants.Content_type);
        httpPost.put("X-Lang", OpenApiConstants.X_Lang);
        httpPost.put("X-Channel", OpenApiConstants.X_Channel);
        httpPost.put("X-Dt", OpenApiConstants.X_Dt);
        httpPost.put("X-Type", OpenApiConstants.X_Type);

        OpenHttpResponse openHttpResponse = new OpenHttpResponse();
        try {
            switch (openHttpRequest.getParameters().get("url").toString()) {
                case OpenApiUrl.marketstate:
                    jsonObj.put("market", (openHttpRequest.getParameters()).get("market").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.signHz(token + OpenApiConstants.X_Channel + OpenApiConstants.X_Lang + (openHttpRequest.getParameters()).get("X_Request_Id").toString() + X_Time + json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Time", X_Time.toString());
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.basicinfo:
                    jsonObj.put("market", (openHttpRequest.getParameters()).get("market").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.signHz(token + OpenApiConstants.X_Channel + OpenApiConstants.X_Lang + (openHttpRequest.getParameters()).get("X_Request_Id").toString() + X_Time + json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Time", X_Time.toString());
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.realtime:
                    jsonObj.put("secuIds", (openHttpRequest.getParameters()).get("secuIds"));
                    json = jsonObj.toString();
                    XSign = RSAUtil.signHz(token + OpenApiConstants.X_Channel + OpenApiConstants.X_Lang + (openHttpRequest.getParameters()).get("X_Request_Id").toString() + X_Time + json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Time", X_Time.toString());
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.timeline:
                    jsonObj.put("secuId", (openHttpRequest.getParameters()).get("secuId").toString());
                    jsonObj.put("type", (openHttpRequest.getParameters()).get("type"));
                    json = jsonObj.toString();
                    XSign = RSAUtil.signHz(token + OpenApiConstants.X_Channel + OpenApiConstants.X_Lang + (openHttpRequest.getParameters()).get("X_Request_Id").toString() + X_Time + json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Time", X_Time.toString());
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.kline:
                    jsonObj.put("secuId", (openHttpRequest.getParameters()).get("secuId").toString());
                    jsonObj.put("type", (openHttpRequest.getParameters()).get("type"));
                    jsonObj.put("start", (openHttpRequest.getParameters()).get("start"));
                    jsonObj.put("right", (openHttpRequest.getParameters()).get("right"));
                    jsonObj.put("count", (openHttpRequest.getParameters()).get("count"));
                    json = jsonObj.toString();
                    XSign = RSAUtil.signHz(token + OpenApiConstants.X_Channel + OpenApiConstants.X_Lang + (openHttpRequest.getParameters()).get("X_Request_Id").toString() + X_Time + json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Time", X_Time.toString());
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.tick:
                    jsonObj.put("secuId", (openHttpRequest.getParameters()).get("secuId").toString());
                    jsonObj.put("tradeTime", (openHttpRequest.getParameters()).get("tradeTime"));
                    jsonObj.put("seq", (openHttpRequest.getParameters()).get("seq"));
                    jsonObj.put("count", (openHttpRequest.getParameters()).get("count"));
                    jsonObj.put("sortDirection", (openHttpRequest.getParameters()).get("sortDirection"));
                    json = jsonObj.toString();
                    XSign = RSAUtil.signHz(token + OpenApiConstants.X_Channel + OpenApiConstants.X_Lang + (openHttpRequest.getParameters()).get("X_Request_Id").toString() + X_Time + json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Time", X_Time.toString());
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
                case OpenApiUrl.orderbook:
                    jsonObj.put("secuId", (openHttpRequest.getParameters()).get("secuId").toString());
                    json = jsonObj.toString();
                    XSign = RSAUtil.signHz(token + OpenApiConstants.X_Channel + OpenApiConstants.X_Lang + (openHttpRequest.getParameters()).get("X_Request_Id").toString() + X_Time + json, null);
                    httpPost.put("Authorization", token);
                    httpPost.put("X-Sign", XSign);
                    httpPost.put("X-Time", X_Time.toString());
                    httpPost.put("X-Request-Id", (openHttpRequest.getParameters()).get("X_Request_Id").toString());
                    break;
            }

            openHttpResponse = openapiimplHq((openHttpRequest.getParameters()).get("url").toString(), json, httpPost);
            return openHttpResponse;
        } catch (Exception e) {
            openHttpResponse.setCode("1300105");
            openHttpResponse.setMsg("系统异常");
            return openHttpResponse;
        }
    }


    public OpenHttpResponse openapiimplHq(String url, String json_login, Map<String, String> httpPost_login) throws Exception {

        OpenHttpResponse openHttpResponse = new OpenHttpResponse();
//        String response_login = HttpClientUtil.postJson(OpenApiUrl.base_url_hq + url, json_login, httpPost_login, null);
        String response_login = okHttpUtil.postData(OpenApiUrl.base_url_hq + url, json_login, httpPost_login);
        System.out.println("response_login返回对象 = " + response_login);
        JSONObject jsonObject_login = JSON.parseObject(response_login);
        openHttpResponse.setCode(jsonObject_login.get("code").toString());
        openHttpResponse.setMsg(jsonObject_login.get("msg").toString());
        if (openHttpResponse.getCode().equals("0")) {
            openHttpResponse.setData(jsonObject_login.get("data"));
        }

        return openHttpResponse;
    }

    @Override
    public void openapiHqPush(OpenHttpRequest openHttpRequest) {

        //自动登录获取 token
        if(!StringUtils.isNotEmpty(token)){
            token = ((JSONObject) AutoLoginDemo.login().getData()).get("token").toString();
        }

        JSONObject jsonObj = new JSONObject();
        jsonObj.put("op", OpenApiConstants.OP_AUTH);
        jsonObj.put("reqId", 666666);
        jsonObj.put("ts", 0);
        jsonObj.put("accessToken", token);
        String jsonSend = jsonObj.toString();


        try {
            client = new WebSocketClient(new URI(OpenApiUrl.quote_push_url), new Draft_6455()) {
                @Override
                public void onOpen(ServerHandshake serverHandshake) {
                    logger.info("连接成功");
                    //鉴权
                    client.send(jsonSend);

                    if(OpenApiConstants.OP_SUB.equals(openHttpRequest.getParameters().get("op").toString())){
                        //订阅行情
                        JSONObject jsonObj1 = new JSONObject();
                        jsonObj1.put("op", openHttpRequest.getParameters().get("op").toString());
                        jsonObj1.put("ts", X_Time);
                        jsonObj1.put("reqId", openHttpRequest.getParameters().get("reqId"));
                        jsonObj1.put("topiclist",openHttpRequest.getParameters().get("secuIds"));
                        client.send(jsonObj1.toString());
                    }

                    //取消订阅
                    if(OpenApiConstants.OP_UNSUB.equals(openHttpRequest.getParameters().get("op").toString())){
                    JSONObject jsonObj2 = new JSONObject();
                    jsonObj2.put("op", OpenApiConstants.OP_UNSUB);
                    jsonObj2.put("ts", X_Time);
                    jsonObj2.put("reqId", openHttpRequest.getParameters().get("reqId"));
                    jsonObj2.put("topiclist", openHttpRequest.getParameters().get("secuIds").toString());
                    client.send(jsonObj2.toString());
                    }


                }

                //接收消息
                @Override
                public void onMessage(String msg) {
                    if (null != msg && !msg.trim().equals("")) {
                        try {
                            JSONObject jsonObj = new JSONObject();
                            JSONObject jsonObject = JSON.parseObject(msg);

                            if (OpenApiConstants.OP_AUTH.equals(jsonObject.get("op").toString())) {
                                logger.info("服务端鉴权成功！" + msg);
                            }

                            if (OpenApiConstants.OP_PING.equals(jsonObject.get("op").toString())) {
                                logger.info("服务端发送Ping数据对象" + msg);
                                jsonObj.put("op", OpenApiConstants.OP_PONG);
                                jsonObj.put("ts", 0);
                                jsonObj.put("reqId", 666666);
                                if (client != null) {
                                    client.send(jsonObj.toString());
                                    logger.info("Pong服务端维持心跳返回数据对象" + msg);
                                }
                            }

                            if (OpenApiConstants.OP_SUB.equals(jsonObject.get("op").toString())) {
                                logger.info("订阅行情成功！" + msg);
                            }

                            if (OpenApiConstants.OP_UNSUB.equals(jsonObject.get("op").toString())) {
                                logger.info("取消订阅行情成功！" + msg);
                            }


                            if (OpenApiConstants.OP_UPDATE.equals(jsonObject.get("op").toString())) {
                                logger.info("服务端行情推送数据" + msg);
                                String result = jsonObject.get("data").toString();
                                final Base64.Decoder decoder = Base64.getDecoder();
                                System.out.println(new String(decoder.decode(result), "UTF-8"));
                                result = decoder.decode(result).toString();
                                logger.info("服务端行情推送数据" + result);
                            }

                            //对消息做业务处理
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }

                @Override
                public void onClose(int i, String s, boolean b) {
                    logger.info("连接已关闭");
                }

                @Override
                public void onError(Exception e) {
                    logger.error("发生错误，关闭");
//                    new MyWebSocketClient().createClient(jsonSend);
                }
            };
        } catch (URISyntaxException e) {
            e.printStackTrace();
        }

        client.connect();
        while (!client.getReadyState().equals(WebSocket.READYSTATE.OPEN)) {
//            logger.info("正在连接");
        }
    }


}
