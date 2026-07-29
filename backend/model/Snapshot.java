package com.mahagnan.model;

import java.time.LocalDateTime;

public class Snapshot {

    private String id;
    private String studentUid;
    private String imageUrl;
    private String cloudinaryPublicId;
    private String violationType;
    private LocalDateTime capturedAt;

    public Snapshot() {
    }

    public Snapshot(String id, String studentUid, String imageUrl,
                    String cloudinaryPublicId, String violationType,
                    LocalDateTime capturedAt) {
        this.id = id;
        this.studentUid = studentUid;
        this.imageUrl = imageUrl;
        this.cloudinaryPublicId = cloudinaryPublicId;
        this.violationType = violationType;
        this.capturedAt = capturedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getStudentUid() {
        return studentUid;
    }

    public void setStudentUid(String studentUid) {
        this.studentUid = studentUid;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getCloudinaryPublicId() {
        return cloudinaryPublicId;
    }

    public void setCloudinaryPublicId(String cloudinaryPublicId) {
        this.cloudinaryPublicId = cloudinaryPublicId;
    }

    public String getViolationType() {
        return violationType;
    }

    public void setViolationType(String violationType) {
        this.violationType = violationType;
    }

    public LocalDateTime getCapturedAt() {
        return capturedAt;
    }

    public void setCapturedAt(LocalDateTime capturedAt) {
        this.capturedAt = capturedAt;
    }
}
