package com.mahagnan.model;

public class Admin {

    private String uid;
    private String name;
    private String email;
    private String role;
    private boolean active;

    public Admin() {
    }

    public Admin(String uid, String name, String email,
                 String role, boolean active) {
        this.uid = uid;
        this.name = name;
        this.email = email;
        this.role = role;
        this.active = active;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
