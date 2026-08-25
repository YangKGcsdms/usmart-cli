package com.yxzq.openapi.example;

import com.yxzq.openapi.config.OpenApiUrl;
import com.yxzq.openapi.https.request.OpenHttpRequest;
import com.yxzq.openapi.https.response.OpenHttpResponse;
import com.yxzq.openapi.service.OpenApiService;
import com.yxzq.openapi.service.impl.OpenApiServiceImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * @title:
 * @projectName: 基础行情开放API
 * @description: TODO
 * @author: shizhibiao
 * @date: 2021/5/13 16:08
 */
public class OpenApiQuoteDemo {

    static OpenApiService openApiService = new OpenApiServiceImpl();

    private static final Logger logger = LoggerFactory.getLogger(OpenApiQuoteDemo.class);

    public static void main(String[] args){

//        /****************************** 1.1渠道密码登录 ****************************/
//        OpenHttpResponse openHttpResponse = null;
//        openHttpResponse  = login();
//        if(!openHttpResponse.getCode().equals("0")){
//            return;
//        }



        /****************************** 市场状态接口 *********************************/
        OpenHttpResponse openHttpResponse = null;
        openHttpResponse = marketState();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 基础信息接口 *********************************/
        openHttpResponse = basicinfo();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 实时行情接口 *********************************/
        openHttpResponse = realtime();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 分时接口 *********************************/
        openHttpResponse = timeline();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** K线接口 *********************************/
        openHttpResponse = kline();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 逐笔接口 *********************************/
        openHttpResponse = tick();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 买卖盘接口 *********************************/
        openHttpResponse = orderbook();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

    }

//    public static OpenHttpResponse login(){
//        Map<String, Object> params = new HashMap<String, Object>();
//        params.put("phoneNumber", "15210372164");
//        params.put("password", "qwe123456");
//        params.put("url", OpenApiUrl.login);
//        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
//        openHttpRequest.setParameters(params);
//        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
//        logger.info("渠道密码登录返回对象：" + openHttpResponse);
//        return openHttpResponse;
//    }


    public static OpenHttpResponse marketState(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("market", "sh");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.marketstate);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapiHq(openHttpRequest);
        logger.info("市场状态接口返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse basicinfo(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("market", "sh");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.basicinfo);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapiHq(openHttpRequest);
        logger.info("基础信息接口返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse realtime(){
        String[] secuIds={"sz000001", "hk00700"};
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("secuIds", secuIds);
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.realtime);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapiHq(openHttpRequest);
        logger.info("实时行情接口返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse timeline(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("secuId", "sz000001");
        params.put("type", 0);
        params.put("X_Request_Id", "928239187123721231233");
        params.put("url", OpenApiUrl.timeline);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapiHq(openHttpRequest);
        logger.info("分时接口返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse kline(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("secuId", "sz000001");
        params.put("type", 7);
        params.put("start", 0);
        params.put("count", 2);
        params.put("right", 0);
        params.put("X_Request_Id", "928239187123721231233");
        params.put("url", OpenApiUrl.kline);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapiHq(openHttpRequest);
        logger.info("K线接口返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse tick(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("secuId", "sz000001");
        params.put("tradeTime", 0);
        params.put("seq", 0);
        params.put("count", 2);
        params.put("sortDirection", 1);
        params.put("X_Request_Id", "928239187123721231233");
        params.put("url", OpenApiUrl.tick);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapiHq(openHttpRequest);
        logger.info("逐笔接口返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse orderbook(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("secuId", "sz000001");
        params.put("X_Request_Id", "928239187123721231233");
        params.put("url", OpenApiUrl.orderbook);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapiHq(openHttpRequest);
        logger.info("买卖盘接口返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }


}
