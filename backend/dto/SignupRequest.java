package com.mahagnan.dto;

public class SignupRequest {

    private String fullName;
    private String email;
    private String password;
    private String phone;
    private String college;
    private String referencePhotoUrl;

    public SignupRequest() {
    }

    public SignupRequest(String fullName,
                         String email,
                         String password,
                         String phone,
                         String college,
                         String referencePhotoUrl) {
        this.fullName = fullName;
        this.email = email;
        this.password = password;
        this.phone = phone;
        this.college = college;
        this.referencePhotoUrl = referencePhotoUrl;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getCollege() {
        return college;
    }

    public void setCollege(String college) {
        this.college = college;
    }

    public String getReferencePhotoUrl() {
        return referencePhotoUrl;
    }

    public void setReferencePhotoUrl(String referencePhotoUrl) {
        this.referencePhotoUrl = referencePhotoUrl;
    }
}
