package com.yxzq.openapi.example;

import com.yxzq.openapi.https.request.OpenHttpRequest;
import com.yxzq.openapi.https.response.OpenHttpResponse;
import com.yxzq.openapi.service.OpenApiService;
import com.yxzq.openapi.service.impl.OpenApiServiceImpl;
import com.yxzq.openapi.config.OpenApiUrl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * @title:
 * @projectName: 交易OPEN API接口
 * @description: TODO
 * @author: shizhibiao
 * @date: 2021/5/13 16:08
 */
public class OpenApiTradeDemo {

    static OpenApiService openApiService = new OpenApiServiceImpl();

    private static final Logger logger = LoggerFactory.getLogger(OpenApiTradeDemo.class);

    public static void main(String[] args){

        /****************************** 1.1渠道密码登录 ****************************/
        OpenHttpResponse openHttpResponse = null;
        openHttpResponse  = login();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }
        /****************************** 1.2获取手机验证码(登陆验证码) ****************************/
        openHttpResponse = sendPhoneCaptcha("106");
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 1.5校验交易密码 start ****************************/

        openHttpResponse = checkTradePassword();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 获取手机验证码(重置登陆密码验证码) **************/
        openHttpResponse = sendPhoneCaptcha("102");
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /***重置登陆密码后会导致token失效，需要重新获取token，所以这里暂时不执行这个方法***/

        /****************************** 1.6重置登录密码 start ****************************/
//        openHttpResponse = resetLoginPassword();
//        if(!openHttpResponse.getCode().equals("0")){
//            return;
//        }

        /****************************** 1.7解锁交易 *******************************/
        openHttpResponse = tradeLogin();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 1.8获取交易解锁状态 ****************************/
        openHttpResponse = getTradeStatus();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 1.9修改交易密码 start ****************************/
        openHttpResponse = updateTradePassword();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /***********修改登陆密码后会导致token失效，需要重新获取token，所以这里暂时不执行这个方法*****/
        /****************************** 1.11修改登录密码 start ****************************/
//        openHttpResponse = updateLoginPassword();
//        if(!openHttpResponse.getCode().equals("0")){
//            return;
//        }

        /*****接口已调通，但是返回的参数和文档不一致。实际返回参数data中是一个对象，包含很多属性**********/
        /****************************** 1.12根据市场查询账户类型 ****************************/
        openHttpResponse = getUserStockType();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 1.13 根据资金账号查询融资利率 ****************************/
        openHttpResponse = getRateByFundAccount();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 2.1下单  *********************************/
        openHttpResponse = order();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 2.2委托改单/撤单  ***************************/
        openHttpResponse = modifyOrder();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 2.3改单范围 *********************************/
        openHttpResponse = modifiedRange();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 2.4碎股下单 *********************************/

        /******************************  碎股下单之前要先调用解锁交易接口 1.7解锁交易 *******************************/
//        openHttpResponse = tradeLogin();
//        if(!openHttpResponse.getCode().equals("0")){
//            return;
//        }

        //碎股交易数量超过持仓碎股可卖数量
//        openHttpResponse = oddEntrust();
//        if(!openHttpResponse.getCode().equals("0")){
//            return;
//        }

        /****************************** 3.1获取IPO列表-分页查询 *********************************/
        openHttpResponse = ipoList();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 3.2获取新股详细信息 *********************************/
        openHttpResponse = ipoInfo();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

        /****************************** 3.3ipo新股认购 *********************************/
        /******************************  新股认购之前要先调用解锁交易接口 1.7解锁交易 *******************************/
        openHttpResponse = tradeLogin();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }
        openHttpResponse = applyIpo();
        if(!openHttpResponse.getCode().equals("0")){
            return;
        }

    }

    public static OpenHttpResponse login(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("phoneNumber", "15210372164");
        params.put("password", "qwe123456");
        params.put("url", OpenApiUrl.login);
        params.put("captcha", "123456");
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("渠道密码登录返回对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse sendPhoneCaptcha(String type){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("phoneNumber", "15210372164");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.send_phone_captcha);
        params.put("type", type);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("请求验证码返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse loginCaptcha(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("phoneNumber", "15210372164");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.login_captcha);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("渠道验证码登录返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse checkTradePassword(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("password", "123456");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.check_trade_password);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("校验交易密码返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse resetLoginPassword(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("password", "qwe123456");
        params.put("phoneNumber", "15210372164");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.reset_login_password);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("重置登录密码返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse tradeLogin(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("password", "123456");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.trade_login);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("解锁交易返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse getTradeStatus(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("password", "123456");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.get_trade_status);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("获取交易解锁状态返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse updateTradePassword(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("oldPassword", "123456");
        params.put("newPassword", "123456");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.update_trade_password);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("修改交易密码返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse updateLoginPassword(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("oldPassword", "qwe123456");
        params.put("newPassword", "qwe123456");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.update_login_password);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("修改登录密码返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse getUserStockType(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("marketType", "3");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.get_user_stock_type);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("根据市场查询账户类型返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse getRateByFundAccount(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("fundAccount", "80019641");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.get_rate_by_fund_account);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("根据资金账号查询融资利率返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse order(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("serialNo", "2000000000000000022");
        params.put("entrustAmount", "100");
        params.put("entrustPrice", "250");
        params.put("entrustProp", "e");
        params.put("entrustType", "0");
        params.put("exchangeType", "0");
        params.put("stockCode", "03690");
        params.put("stockName", "03690");
        params.put("forceEntrustFlag", "false");
        params.put("sessionType", "0");
        params.put("password", "123456");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.order);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("下单交易返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse modifyOrder(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("actionType", "0");
        params.put("entrustAmount", "0");
        params.put("entrustPrice", "0");
        params.put("forceEntrustFlag", "True");
        params.put("password", "123456");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.modify_order);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("托改单/撤单返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse modifiedRange(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("newPrice", "323");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.modified_range);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("改单范围返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse oddEntrust(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("entrustAmount", 1);
        params.put("entrustPrice", 82.1);
        params.put("entrustType", 1);
        params.put("exchangeType", 0);
        params.put("stockCode", "03690");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.odd_entrust);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("碎股下单返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }


    public static OpenHttpResponse ipoList(){
        Map<String, Object> params = new HashMap<String, Object>();

        params.put("pageNum", "1");
        params.put("pageSize", "10");
        params.put("status", "1");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.ipo_list);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("获取IPO列表-分页查询返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse ipoInfo(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("ipoId", "1303001330712207360");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.ipo_info);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("获取新股详细信息返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }

    public static OpenHttpResponse applyIpo(){
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("ipoId", "1303001330712207360");
        params.put("applyQuantity", "100");
        params.put("applyType", "1");
        params.put("serialNo", "1182189250463484234");
        params.put("cash", "0");
        params.put("X_Request_Id", "928239187123721231232");
        params.put("url", OpenApiUrl.apply_ipo);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.openapi(openHttpRequest);
        logger.info("ipo新股认购返回参数对象：" + openHttpResponse);
        return openHttpResponse;
    }


}
