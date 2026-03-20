package project.TutorLab.dto;

import java.util.List;

public class StudentUpdateDto {
    private String firstName;
    private String lastName;
    private Integer age;
    private List<String> interests;

    public StudentUpdateDto() {}

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public List<String> getInterests() { return interests; }
    public void setInterests(List<String> interests) { this.interests = interests; }
}
