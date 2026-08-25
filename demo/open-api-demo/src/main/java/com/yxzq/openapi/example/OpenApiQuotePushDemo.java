package com.yxzq.openapi.example;

/**
 * @title:
 * @projectName: 行情推送接入协议
 * @description: TODO
 * @author: shizhibiao
 * @date: 2021/5/18 16:10
 */

import com.yxzq.openapi.https.request.OpenHttpRequest;
import com.yxzq.openapi.service.OpenApiService;
import com.yxzq.openapi.service.impl.OpenApiServiceImpl;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class OpenApiQuotePushDemo {

    static OpenApiService openApiService = new OpenApiServiceImpl();

    public static void main(String[] args) {
        //订阅
        sub();
        //取消订阅
//        unsub();
    }

    public static void sub() {
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        String[] secuIds = {"rt.sz.000001", "ob.sz.000001", "tk.sz.000001"};
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("secuIds", secuIds);
        params.put("op", "sub");
        params.put("reqId", 666666);
        openHttpRequest.setParameters(params);
        openApiService.openapiHqPush(openHttpRequest);
    }

    public static void unsub() {
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        String[] secuIds = {"rt.sz.000001", "ob.sz.000001", "tk.sz.000001"};
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("secuIds", secuIds);
        params.put("op", "unsub");
        params.put("reqId", 666666);
        openHttpRequest.setParameters(params);
        openApiService.openapiHqPush(openHttpRequest);
    }

}
