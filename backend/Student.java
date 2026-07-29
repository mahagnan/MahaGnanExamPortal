package com.mahagnan.model;

import java.time.LocalDateTime;

public class Student {

    private String uid;
    private String fullName;
    private String email;
    private String phone;
    private String college;
    private String referencePhoto;
    private boolean faceVerified;
    private LocalDateTime createdAt;

    public Student() {
    }

    public Student(String uid,
                   String fullName,
                   String email,
                   String phone,
                   String college,
                   String referencePhoto,
                   boolean faceVerified,
                   LocalDateTime createdAt) {

        this.uid = uid;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.college = college;
        this.referencePhoto = referencePhoto;
        this.faceVerified = faceVerified;
        this.createdAt = createdAt;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
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

    public String getReferencePhoto() {
        return referencePhoto;
    }

    public void setReferencePhoto(String referencePhoto) {
        this.referencePhoto = referencePhoto;
    }

    public boolean isFaceVerified() {
        return faceVerified;
    }

    public void setFaceVerified(boolean faceVerified) {
        this.faceVerified = faceVerified;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

}
