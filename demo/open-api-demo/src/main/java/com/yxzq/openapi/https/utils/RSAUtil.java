package com.yxzq.openapi.https.utils;


import com.yxzq.openapi.config.RsaConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Cipher;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

public class RSAUtil {

    public static final Logger LOGGER = LoggerFactory.getLogger(RSAUtil.class);

    private static PublicKey publicKey;
    private static PrivateKey privateKey;


    private static final String PUBLIC_KEY = RsaConstants.PUBLIC_KEY;

    private static final String PRIVATE_KEY = RsaConstants.PRIVATE_KEY;

    /**
     * 初始化publicKey和privateKey对象
     */
//    @PostConstruct
//    public void init() throws Exception {
//        System.out.println(".............................");
//        X509EncodedKeySpec publicKeySpec = new X509EncodedKeySpec(Base64.getDecoder().decode(PUBLIC_KEY.getBytes()));
//        PKCS8EncodedKeySpec privateKeySpec = new PKCS8EncodedKeySpec(Base64.getDecoder().decode(PRIVATE_KEY.getBytes()));
//        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
//        publicKey = keyFactory.generatePublic(publicKeySpec);
//        privateKey = keyFactory.generatePrivate(privateKeySpec);
//    }


    /**
     *  加密
     *  encrypt str->URLSAFE_BASE64(RSA(str)) 
     *  @param str 
     *  @return if no exception return URLSAFE_BASE64(RSA(str)) , else return null 
     *  
     */
    public static String encrypt(String str) {
        try {
            X509EncodedKeySpec publicKeySpec = new X509EncodedKeySpec(Base64.getDecoder().decode(PUBLIC_KEY.getBytes()));
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            publicKey = keyFactory.generatePublic(publicKeySpec);

            Cipher encoder = Cipher.getInstance("RSA/ECB/PKCS1Padding");
            encoder.init(Cipher.ENCRYPT_MODE, publicKey);
            byte[] rsa = encoder.doFinal(str.getBytes());
            String base64 = java.util.Base64.getUrlEncoder().encodeToString(rsa);
            return base64;
        } catch (Exception e) {
            LOGGER.error("encrypt str:{} failed, exception is ", str, e);
        }
        return null;
    }

    /**
     * decrypt URLSAFE_BASE64(RSA(password))->password
     *
     * @param str
     *            URLSAFE_BASE64(RSA(password))
     * @return if no exception return password, else return str.
     */
    public static String decrypt(String str) {
        try {
            Cipher decoder = Cipher.getInstance("RSA/ECB/PKCS1Padding");
            decoder.init(Cipher.DECRYPT_MODE, privateKey);
            byte[] decodedStr = Base64.getUrlDecoder().decode(str);
            String result = new String(decoder.doFinal(decodedStr));
            return result;
        } catch (Exception e) {
            LOGGER.error("decrypt str:{} failed, exception is ", str, e);
        }
        return null;
    }


    /**
     *  
     *      * 交易签名 
     *      * 
     *      * @param data 待签名数据 
     *      * @return 交易签名 
     *      
     */
    public static String sign(String data, PrivateKey privateKey) throws Exception {

        PKCS8EncodedKeySpec privateKeySpec = new PKCS8EncodedKeySpec(Base64.getDecoder().decode(PRIVATE_KEY.getBytes()));
        KeyFactory keyFactory1 = KeyFactory.getInstance("RSA");
        privateKey = keyFactory1.generatePrivate(privateKeySpec);


        byte[] keyBytes = privateKey.getEncoded();
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        PrivateKey key = keyFactory.generatePrivate(keySpec);
        Signature signature = Signature.getInstance("MD5withRSA");
        signature.initSign(key);
        signature.update(data.getBytes());
        return new String(org.apache.commons.codec.binary.Base64.encodeBase64(signature.sign()));
    }

    /**
     *  
     *      * 行情签名 
     *      * 
     *      * @param data 待签名数据 
     *      * @return 行情签名 
     *      
     */
    public static String signHz(String data, PrivateKey privateKey) throws Exception {

        PKCS8EncodedKeySpec privateKeySpec = new PKCS8EncodedKeySpec(Base64.getDecoder().decode(PRIVATE_KEY.getBytes()));
        KeyFactory keyFactory1 = KeyFactory.getInstance("RSA");
        privateKey = keyFactory1.generatePrivate(privateKeySpec);


        byte[] keyBytes = privateKey.getEncoded();
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        PrivateKey key = keyFactory.generatePrivate(keySpec);
        Signature signature = Signature.getInstance("MD5withRSA");
        signature.initSign(key);
        signature.update(data.getBytes());
        return new String(org.apache.commons.codec.binary.Base64.encodeBase64URLSafe(signature.sign()));
    }
}